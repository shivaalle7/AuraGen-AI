"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useValidationTelemetry } from "./validation-telemetry";

import { allFields, fields, initialAnswers, nextCorrection, parseLayout, sectionFor, sections, validateField, validationMessages, incomeMinimumHint, amountMinimumHint, minimumMonthlyIncome, minimumLoanAmount, type Answers, type Field, type LayoutStep, type ValidationCode } from "./loan-layout";

type Errors = Partial<Record<Field, ValidationCode>>;

type LayoutSource = "simulated" | "model" | "cached" | "fallback";

const sourceLabels: Record<LayoutSource, string> = {
  simulated: "Simulated adaptive guide",
  model: "AI-generated guide",
  cached: "Cached AI-generated guide",
  fallback: "Built-in fallback",
};

const layoutTargetMs = 2000;
const failureThreshold = 3;
const failureWindowMs = 30_000;

const button = "rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700";
const secondary = button + " border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

export default function Home() {
  const sendValidationFailure = useValidationTelemetry();
  const [answers, setAnswers] = useState(initialAnswers);
  const latestAnswers = useRef(initialAnswers);
  const [errors, setErrors] = useState<Errors>({});
  const invalidFields = allFields.filter((field) => errors[field]);
  const [guided, setGuided] = useState(false);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [offeredField, setOfferedField] = useState<Field | null>(null);
  const lastEditedField = useRef<Field | null>(null);
  const failures = useRef<{ field: Field; count: number; startedAt: number } | null>(null);
  const firstOfferedError = offeredField === null
    ? null
    : nextCorrection(answers) ?? offeredField;
  const offeredSection = firstOfferedError === null ? null : sectionFor(firstOfferedError);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);
  const [repairField, setRepairField] = useState<Field | null>(null);
  const [adaptedLayout, setAdaptedLayout] = useState<LayoutStep[] | null>(null);
  const [layoutSource, setLayoutSource] = useState<LayoutSource | null>(null);
  const [lastAdaptation, setLastAdaptation] = useState<{
    field: Field;
    errorCode: ValidationCode;
    repeatCount: number;
    source: LayoutSource;
    durationMs: number;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const activeSections = guided && adaptedLayout ? adaptedLayout : sections;
  const lastStep = step === activeSections.length - 1;
  const remainingCorrections = repairField === null
    ? null
    : allFields.filter((field) => validateField(field, answers)).length;

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (focusTarget) document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);

  function loadSampleApplication() {
    if (Object.values(latestAnswers.current).some(Boolean)) return;

    const sample: Answers = {
      ...initialAnswers,
      name: "Avery Demo",
      email: "avery@example.com",
      employment: "Employed",
      income: String(minimumMonthlyIncome - 1),
      amount: String(minimumLoanAmount - 1),
      purpose: "Home improvement",
    };
    latestAnswers.current = sample;
    lastEditedField.current = null;
    failures.current = null;
    setAnswers(sample);
    setErrors({});
    setFocusTarget({ id: "income" });
  }

  function changeView() {
    cancelLayoutRequest();
    setLayoutSource(null);
    setRepairField(null);
    if (!guided) setSubmitted(false);
    if (repairField !== null) {
      setAdaptedLayout(null);
      setStep(0);
    }
    setGuided(!guided);
    setOfferedField(null);
    failures.current = null;
    setFocusTarget({ id: guided ? "application-heading" : "section-" + step });
  }

  function goToStep(next: number) {
    setStep(next);
    setFocusTarget({ id: "section-" + next });
  }

  function recordValidationFailure(field: Field, errorCode: ValidationCode) {
    const now = Date.now();
    const previous = failures.current;
    const attempt = previous?.field === field && now - previous.startedAt <= failureWindowMs
      ? { ...previous, count: previous.count + 1 }
      : { field, count: 1, startedAt: now };

    failures.current = attempt;
    sendValidationFailure(field, errorCode, attempt.count);
    setOfferedField((current) => attempt.count >= failureThreshold ? field : current === field ? current : null);
  }

  function cancelLayoutRequest() {
    request.current?.abort();
    request.current = null;
    setPreparing(false);
  }

  function dismissOffer() {
    cancelLayoutRequest();
    if (offeredField) setFocusTarget({ id: offeredField });
    setOfferedField(null);
    failures.current = null;
  }

  async function acceptOffer() {
    if (offeredField === null || request.current) return;
    const fieldId = offeredField;
    const errorCode = validateField(fieldId, answers);
    const repeatCount = failures.current?.count ?? failureThreshold;
    if (!errorCode) return;

    const startedAt = performance.now();
    const controller = new AbortController();
    request.current = controller;
    setPreparing(true);
    let layout: LayoutStep[] | null = null;
    let source: LayoutSource = "fallback";

    try {
      const demo = process.env.NODE_ENV === "development"
        ? new URLSearchParams(window.location.search).get("layoutDemo")
        : null;
      const demoQuery = demo === "timeout" || demo === "simulated" ? "?demo=" + demo : "";
      const response = await fetch("/api/guided-layout" + demoQuery, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId, errorCode, repeatCount }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(demo === "timeout" ? 2500 : 10000)]),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.source === "simulated" || data.source === "model" || data.source === "cached") {
          layout = parseLayout(data, fieldId);
          if (layout) source = data.source;
        }
      }
    } catch {
      // The built-in guide is available when generation fails or times out.
    }

    if (request.current !== controller || controller.signal.aborted) return;
    cancelLayoutRequest();
    const firstInvalidField = nextCorrection(latestAnswers.current);
    if (!firstInvalidField) return;
    setAdaptedLayout(layout);
    setRepairField(firstInvalidField);
    setSubmitted(false);
    setLayoutSource(source);
    setLastAdaptation({
      field: fieldId,
      errorCode,
      repeatCount,
      source,
      durationMs: performance.now() - startedAt,
    });
    setGuided(true);
    setOfferedField(null);
    failures.current = null;
    goToStep(sectionFor(firstInvalidField, layout ?? sections));
  }

  function update(input: keyof Answers, value: string) {
    const field = input === "otherPurpose" ? "purpose" : input;
    const nextAnswers = { ...latestAnswers.current, [input]: value };
    const error = validateField(field, nextAnswers);
    lastEditedField.current = field;
    if ((offeredField === field || failures.current?.field === field) && !error) {
      failures.current = null;
      if (offeredField === field) dismissOffer();
    }

    latestAnswers.current = nextAnswers;
    setAnswers(nextAnswers);
    setErrors((previous) => ({ ...previous, [field]: previous[field] ? error : undefined }));
    setSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const continuing = guided && !lastStep;
    const checkedFields = continuing && repairField === null ? activeSections[step].fields : allFields;
    const nextErrors: Errors = {};
    for (const field of checkedFields) nextErrors[field] = validateField(field, answers);
    setErrors((previous) => ({ ...previous, ...nextErrors }));

    const firstError = repairField !== null
      ? nextCorrection(answers, repairField)
      : checkedFields.find((field) => nextErrors[field]);
    if (firstError) {
      setSubmitted(false);
      if (guided) {
        if (repairField !== null) setRepairField(firstError);
        setStep(sectionFor(firstError, activeSections));
        setFocusTarget({ id: nextErrors[firstError] === "missing_other_purpose" ? "otherPurpose" : firstError });
      } else {
        // Prefer the error the user is working on when other fields are still blank.
        const editedField = lastEditedField.current;
        const target = editedField !== null && nextErrors[editedField] ? editedField : firstError;
        const errorCode = nextErrors[target];
        if (errorCode) recordValidationFailure(target, errorCode);
        setFocusTarget({ id: errorCode === "missing_other_purpose" ? "otherPurpose" : target });
      }
      return;
    }

    failures.current = null;
    setOfferedField(null);
    if (repairField !== null) {
      changeView();
      setFocusTarget({ id: repairField });
      return;
    }
    if (continuing) {
      goToStep(step + 1);
      return;
    }
    if (guided) changeView();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 font-sans text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <span className="text-lg font-semibold tracking-tight">AuraGen</span>
          <span className="text-sm text-slate-300">Demo workspace</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-9 sm:px-8 lg:grid-cols-[1fr_2fr] lg:py-14">
        <section aria-labelledby="application-heading">
          <h1 id="application-heading" tabIndex={-1} className="text-4xl font-semibold tracking-tight">Loan application</h1>
          <p className="mt-3 max-w-xs text-slate-600">Use fictional details to try the application in either view.</p>
          <button type="button" onClick={changeView} className={secondary + " mt-5"}>
            {guided ? "Return to standard view" : "Use guided mode"}
          </button>
          {!guided && !Object.values(answers).some(Boolean) && (
            <div className="mt-3">
              <button type="button" onClick={loadSampleApplication} className={secondary}>
                Load sample application
              </button>
              <p className="mt-2 text-sm text-slate-600">Fills the form with fictional answers and two values to correct.</p>
            </div>
          )}
          {offeredSection !== null && (
            <aside aria-labelledby="guided-offer-heading" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div role="status">
                <h2 id="guided-offer-heading" className="font-semibold text-teal-950">
                  Need help with {sections[offeredSection].title.toLowerCase()}?
                </h2>
                <p className="mt-1 text-sm text-slate-700">Try this section in guided mode. Your answers will carry over.</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={acceptOffer} disabled={preparing} className={button + " bg-teal-800 text-white hover:bg-teal-900"}>
                  {preparing ? "Preparing guided section…" : "Open guided section"}
                </button>
                <button type="button" onClick={dismissOffer} className={secondary}>Stay in standard view</button>
              </div>
            </aside>
          )}
          {layoutSource && (
            <p role="status" className="mt-4 text-sm text-slate-600">
              {layoutSource === "fallback" ? "Using the built-in guide." : sourceLabels[layoutSource] + "."}
            </p>
          )}
          <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-800">Adaptation diagnostics</summary>
            {lastAdaptation ? (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <dt className="text-slate-600">Field</dt>
                <dd>{fields[lastAdaptation.field].label}</dd>
                <dt className="text-slate-600">Trigger</dt>
                <dd>{lastAdaptation.repeatCount} failed attempts. {validationMessages[lastAdaptation.errorCode]}</dd>
                <dt className="text-slate-600">Source</dt>
                <dd>{sourceLabels[lastAdaptation.source]}</dd>
                <dt className="text-slate-600">Layout ready</dt>
                <dd>{(lastAdaptation.durationMs / 1000).toFixed(2)} s · {lastAdaptation.durationMs <= layoutTargetMs ? "within" : "over"} 2 s target</dd>
              </dl>
            ) : (
              <p className="mt-3 text-slate-600">Open a suggested guide to see its trigger and timing here.</p>
            )}
          </details>
          {guided && repairField === null && (
            <ol aria-label="Application steps" className="mt-6 space-y-2">
              {activeSections.map((section, index) => (
                <li key={section.fields.join(",")} aria-current={index === step ? "step" : undefined}
                  className={index === step ? "font-semibold text-teal-800" : "text-slate-600"}>
                  {index + 1}. {section.title}
                </li>
              ))}
            </ol>
          )}
        </section>

        <form noValidate onSubmit={handleSubmit} className="space-y-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {!guided && invalidFields.length > 0 && (
            <section aria-labelledby="error-summary-heading" className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h2 id="error-summary-heading" className="font-semibold text-red-950">
                {invalidFields.length === 1 ? "1 field needs attention" : invalidFields.length + " fields need attention"}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-red-900">
                {invalidFields.map((field) => {
                  const error = errors[field];
                  if (!error) return null;
                  const otherPurpose = error === "missing_other_purpose";
                  return (
                    <li key={field}>
                      <button type="button"
                        className="rounded text-left underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={() => setFocusTarget({ id: otherPurpose ? "otherPurpose" : field })}>
                        {otherPurpose ? "Other loan purpose" : fields[field].label}: {validationMessages[error]}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {activeSections.map((section, index) => {
            if (guided && index !== step) return null;
            return (
              <section key={(guided ? "guided-" : "standard-") + section.fields.join(",")}
                aria-labelledby={"section-" + index}
                className={"border-b border-slate-200 pb-6" + (guided ? " guided-section" : "")}>
                <h2 id={"section-" + index} tabIndex={-1} className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {section.fields.length === 1 && section.fields[0] === "income" ? incomeMinimumHint
                    : section.fields.length === 1 && section.fields[0] === "amount" ? amountMinimumHint
                      : section.description}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const definition = fields[field];
                    const error = errors[field];
                    const otherPurposeError = error === "missing_other_purpose";
                    const minimum = field === "income" ? minimumMonthlyIncome : field === "amount" ? minimumLoanAmount : undefined;
                    const hint = field === "income" ? incomeMinimumHint : field === "amount" ? amountMinimumHint : undefined;
                    const describedBy = error && !otherPurposeError ? field + "-error" : hint ? field + "-hint" : undefined;
                    const control = {
                      id: field,
                      name: field,
                      required: true,
                      value: answers[field],
                      "aria-invalid": Boolean(error && !otherPurposeError),
                      "aria-describedby": describedBy,
                      className: "mt-1 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-slate-950 focus-visible:outline-2 focus-visible:outline-teal-700 aria-invalid:border-red-700",
                    };

                    return (
                      <div key={field}>
                        <label htmlFor={field} className="text-sm font-medium">{definition.label}</label>
                        {definition.options ? (
                          <select {...control} onChange={(event) => update(field, event.target.value)}>
                            <option value="">Select an option</option>
                            {definition.options.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        ) : (
                          <input {...control} type={definition.type ?? "text"} min={minimum} step={minimum === undefined ? undefined : "any"}
                            onChange={(event) => update(field, event.target.value)} />
                        )}
                        {hint && !error && <p id={field + "-hint"} className="mt-1 text-sm text-slate-600">{hint}</p>}
                        {error && !otherPurposeError && (
                          <p id={field + "-error"} className="mt-1 text-sm text-red-700">{validationMessages[error]}</p>
                        )}
                        {field === "purpose" && answers.purpose === "Other" && (
                          <div className="mt-4">
                            <label htmlFor="otherPurpose" className="text-sm font-medium">Describe your loan purpose</label>
                            <textarea id="otherPurpose" name="otherPurpose" required rows={3}
                              className={control.className} value={answers.otherPurpose}
                              aria-invalid={otherPurposeError}
                              aria-describedby={otherPurposeError ? "otherPurpose-error" : undefined}
                              onChange={(event) => update("otherPurpose", event.target.value)} />
                            {otherPurposeError && (
                              <p id="otherPurpose-error" className="mt-1 text-sm text-red-700">{validationMessages.missing_other_purpose}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {remainingCorrections !== null && (
              <p role="status" className="mr-auto text-sm text-slate-600">
                {remainingCorrections === 0
                  ? "All fields are valid. Continue to return to the full form."
                  : remainingCorrections === 1
                    ? "1 field still needs attention."
                    : remainingCorrections + " fields still need attention."}
              </p>
            )}
            {guided && repairField === null && step > 0 && <button type="button" onClick={() => goToStep(step - 1)} className={secondary}>Back</button>}
            <button type="submit" className={button + " bg-teal-800 text-white hover:bg-teal-900"}>
              {repairField !== null || (guided && !lastStep) ? "Continue" : "Submit demo application"}
            </button>
          </div>
          <div role="status">
            {submitted && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-950">Demo application complete. Your answers stayed in this browser tab.</p>}
          </div>
        </form>
      </div>
    </main>
  );
}

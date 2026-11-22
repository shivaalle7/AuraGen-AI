"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useValidationTelemetry, validationMessages, type ValidationCode } from "./validation-telemetry";

import { allFields, fields, initialAnswers, parseLayout, sectionFor, sections, type Field, type LayoutStep } from "./loan-layout";

type Errors = Partial<Record<Field, ValidationCode>>;

function validateField(field: Field, answer: string): ValidationCode | undefined {
  const value = answer.trim();
  if (!value) return "required";
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "invalid_email";
  }
  if (field === "income" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    return "invalid_income";
  }
  if (field === "amount" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
    return "invalid_amount";
  }
}

const failureThreshold = 3;
const failureWindowMs = 30_000;

const button = "rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700";
const secondary = button + " border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

export default function Home() {
  const sendValidationFailure = useValidationTelemetry();
  const [answers, setAnswers] = useState(initialAnswers);
  const [errors, setErrors] = useState<Errors>({});
  const [guided, setGuided] = useState(false);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [offeredField, setOfferedField] = useState<Field | null>(null);
  const lastEditedField = useRef<Field | null>(null);
  const failures = useRef<{ field: Field; count: number; startedAt: number } | null>(null);
  const offeredSection = offeredField === null ? null : sectionFor(offeredField);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);
  const [adaptedLayout, setAdaptedLayout] = useState<LayoutStep[] | null>(null);
  const [layoutSource, setLayoutSource] = useState<"simulated" | "model" | "fallback" | null>(null);
  const [preparing, setPreparing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const activeSections = guided && adaptedLayout ? adaptedLayout : sections;
  const lastStep = step === activeSections.length - 1;

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (focusTarget) document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);

  function changeView() {
    cancelLayoutRequest();
    setLayoutSource(null);
    if (adaptedLayout) {
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
    const errorCode = validateField(fieldId, answers[fieldId]);
    const repeatCount = failures.current?.count ?? failureThreshold;
    if (!errorCode) return;

    const controller = new AbortController();
    request.current = controller;
    setPreparing(true);
    let layout: LayoutStep[] | null = null;
    let source: "simulated" | "model" | "fallback" = "fallback";

    try {
      const demoTimeout = process.env.NODE_ENV === "development" &&
        new URLSearchParams(window.location.search).get("layoutDemo") === "timeout";
      const response = await fetch("/api/guided-layout" + (demoTimeout ? "?demo=timeout" : ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId, errorCode, repeatCount }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2500)]),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.source === "simulated" || data.source === "model") {
          layout = parseLayout(data, fieldId);
          if (layout) source = data.source;
        }
      }
    } catch {
      // The built-in guide is available when generation fails or times out.
    }

    if (request.current !== controller || controller.signal.aborted) return;
    cancelLayoutRequest();
    setAdaptedLayout(layout);
    setLayoutSource(source);
    setGuided(true);
    setOfferedField(null);
    failures.current = null;
    goToStep(sectionFor(fieldId, layout ?? sections));
  }

  function update(field: Field, value: string) {
    lastEditedField.current = field;
    if ((offeredField === field || failures.current?.field === field) && !validateField(field, value)) {
      failures.current = null;
      if (offeredField === field) dismissOffer();
    }
    setAnswers((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: previous[field] ? validateField(field, value) : undefined }));
    setSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const continuing = guided && !lastStep;
    const checkedFields = continuing ? activeSections[step].fields : allFields;
    const nextErrors: Errors = {};
    for (const field of checkedFields) nextErrors[field] = validateField(field, answers[field]);
    setErrors((previous) => ({ ...previous, ...nextErrors }));

    const firstError = checkedFields.find((field) => nextErrors[field]);
    if (firstError) {
      setSubmitted(false);
      if (guided) {
        setStep(sectionFor(firstError, activeSections));
        setFocusTarget({ id: firstError });
      } else {
        // Prefer the error the user is working on when other fields are still blank.
        const editedField = lastEditedField.current;
        const target = editedField !== null && nextErrors[editedField] ? editedField : firstError;
        const errorCode = nextErrors[target];
        if (errorCode) recordValidationFailure(target, errorCode);
        setFocusTarget({ id: target });
      }
      return;
    }

    failures.current = null;
    setOfferedField(null);
    if (continuing) {
      goToStep(step + 1);
      return;
    }
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
              {layoutSource === "fallback" ? "Using the built-in guide." : layoutSource === "model" ? "AI-generated guide." : "Simulated adaptive guide."}
            </p>
          )}
          {guided && (
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
          {activeSections.map((section, index) => {
            if (guided && index !== step) return null;
            return (
              <section key={section.fields.join(",")} aria-labelledby={"section-" + index} className="border-b border-slate-200 pb-6">
                <h2 id={"section-" + index} tabIndex={-1} className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const definition = fields[field];
                    const error = errors[field];
                    const control = {
                      id: field,
                      name: field,
                      required: true,
                      value: answers[field],
                      "aria-invalid": Boolean(errors[field]),
                      "aria-describedby": errors[field] ? field + "-error" : undefined,
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
                          <input {...control} type={definition.type ?? "text"}
                            onChange={(event) => update(field, event.target.value)} />
                        )}
                        {error && <p id={field + "-error"} className="mt-1 text-sm text-red-700">{validationMessages[error]}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {guided && step > 0 && <button type="button" onClick={() => goToStep(step - 1)} className={secondary}>Back</button>}
            <button type="submit" className={button + " bg-teal-800 text-white hover:bg-teal-900"}>
              {guided && !lastStep ? "Continue" : "Submit demo application"}
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

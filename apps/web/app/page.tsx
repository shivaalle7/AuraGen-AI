"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { apiErrorSchema, generationResponseSchema, getFieldErrors, parseFormValues, type FieldErrors, type UISpec } from "@auragen/contracts";
const initial: UISpec = {version: 1, title: "Your financial application", description: "A small foundation for a more helpful financial experience.", fields: [
  {id: "fullName", label: "Applicant name", component: "text", help: "Your legal name"},
  {id: "monthlyIncome", label: "Monthly income (₹)", component: "number", help: "Income before deductions"},
  {id: "loanAmount", label: "Requested loan (₹)", component: "number", help: "Total amount requested"}
]};
export default function Home() {
  const [spec, setSpec] = useState(initial);
  const [values, setValues] = useState({fullName: "", monthlyIncome: "", loanAmount: ""});
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validationStatus, setValidationStatus] = useState("");
  const [status, setStatus] = useState("Manual mock demo · automatic friction detection comes later");
  async function simplify() {
    setBusy(true); setStatus("Preparing a simpler interface…");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/ui/generate`, {method: "POST", signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error("Generation unavailable");
      const data = await response.json();
      setSpec(generationResponseSchema.parse(data).spec); setStatus("Mock layout applied. Your entered values are preserved.");
    } catch { setStatus("Could not simplify right now. Your form is still available; please try again."); }
    finally { setBusy(false); }
  }
  async function validateForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseFormValues(values);
    setValidationStatus("");
    if (!result.success) {
      const fields = getFieldErrors(result.error);
      setErrors(fields);
      setValidationStatus("Please correct the highlighted fields.");
      const first = spec.fields.find(field => fields[field.id]);
      if (first) document.getElementById(first.id)?.focus();
      return;
    }
    setErrors({}); setValidating(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/form/validate`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify(result.data), signal: AbortSignal.timeout(10000)
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(data);
        if (parsed.success) {
          setErrors(parsed.data.error.fields ?? {});
          setValidationStatus(parsed.data.error.message);
          return;
        }
        throw new Error("Validation unavailable");
      }
      if (typeof data !== "object" || data === null || !("valid" in data) || data.valid !== true) throw new Error("Invalid response");
      setValidationStatus("Form validated. This demo has not submitted a loan application.");
    } catch { setValidationStatus("Validation is unavailable. Your entries are preserved; please try again."); }
    finally { setValidating(false); }
  }
  return <main><header><small>AURAGEN / FINANCIAL FORM DEMO</small><h1>Finance, with less friction.</h1><p>An adaptive interface prototype. Explore the mock transformation below.</p></header>
    <motion.section layout className="card" aria-labelledby="form-title"><h2 id="form-title">{spec.title}</h2><p>{spec.description}</p>
    <form noValidate onSubmit={validateForm} aria-busy={validating}>
      {spec.fields.map(field => <div className="field" key={field.id}>
        <label htmlFor={field.id}>{field.label}</label>
        <input id={field.id} name={field.id} type={field.component}
          autoComplete={field.id === "fullName" ? "name" : "off"}
          required min={field.component === "number" ? 1 : undefined}
          max={field.id === "monthlyIncome" ? 100000000 : field.id === "loanAmount" ? 1000000000 : undefined}
          step={field.component === "number" ? "any" : undefined}
          maxLength={field.component === "text" ? 100 : undefined}
          value={values[field.id]} disabled={validating}
          onChange={e => {
            setValues(v => ({...v, [field.id]: e.target.value}));
            setErrors(previous => ({...previous, [field.id]: undefined}));
            setValidationStatus("");
          }}
          aria-invalid={Boolean(errors[field.id])}
          aria-describedby={`${field.id}-help${errors[field.id] ? ` ${field.id}-error` : ""}`} />
        <small id={`${field.id}-help`}>{field.help}</small>
        {errors[field.id] && <p className="field-error" id={`${field.id}-error`}>{errors[field.id]}</p>}
      </div>)}
      <p><small>Checking sends these values to the validation API. They are not stored or sent to an AI model.</small></p>
      <button type="submit" disabled={validating}>{validating ? "Checking…" : "Check my details"}</button>
      <p role="status" aria-live="polite">{validationStatus}</p>
    </form>
    <button type="button" disabled={busy} onClick={simplify}>{busy ? "Simplifying…" : "Try a simpler layout"}</button><p role="status">{status}</p></motion.section></main>;
}

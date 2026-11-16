"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { uiSpecSchema, type UISpec } from "@auragen/contracts";
const initial: UISpec = {version: 1, title: "Your financial application", description: "A small foundation for a more helpful financial experience.", fields: [
  {id: "fullName", label: "Applicant name", component: "text", help: "Your legal name"},
  {id: "monthlyIncome", label: "Monthly income (₹)", component: "number", help: "Income before deductions"},
  {id: "loanAmount", label: "Requested loan (₹)", component: "number", help: "Total amount requested"}
]};
export default function Home() {
  const [spec, setSpec] = useState(initial);
  const [values, setValues] = useState({fullName: "", monthlyIncome: "", loanAmount: ""});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Manual mock demo · automatic friction detection comes later");
  async function simplify() {
    setBusy(true); setStatus("Preparing a simpler interface…");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/ui/generate`, {method: "POST", signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error("Generation unavailable");
      const data = await response.json();
      setSpec(uiSpecSchema.parse(data.spec)); setStatus("Mock layout applied. Your entered values are preserved.");
    } catch { setStatus("Could not simplify right now. Your form is still available; please try again."); }
    finally { setBusy(false); }
  }
  return <main><header><small>AURAGEN / DAY 1 FOUNDATION</small><h1>Finance, with less friction.</h1><p>An adaptive interface prototype. Explore the mock transformation below.</p></header>
    <motion.section layout className="card" aria-labelledby="form-title"><h2 id="form-title">{spec.title}</h2><p>{spec.description}</p>
    <form onSubmit={e => e.preventDefault()}>{spec.fields.map(field => <label key={field.id} htmlFor={field.id}>{field.label}<input id={field.id} type={field.component} min={field.component === "number" ? 0 : undefined} value={values[field.id]} onChange={e => setValues(v => ({...v, [field.id]: e.target.value}))} aria-describedby={`${field.id}-help`} /><small id={`${field.id}-help`}>{field.help}</small></label>)}</form>
    <button type="button" disabled={busy} onClick={simplify}>{busy ? "Simplifying…" : "Try a simpler layout"}</button><p role="status">{status}</p></motion.section></main>;
}

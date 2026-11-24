export const sections = [
  { title: "Applicant", description: "Tell us how to address and contact you.", fields: ["name", "email"] },
  { title: "Finances", description: "Enter your employment and income details.", fields: ["employment", "income"] },
  { title: "Loan request", description: "Tell us what you want to borrow and why.", fields: ["amount", "purpose"] },
] as const;

export type Field = (typeof sections)[number]["fields"][number];
export type Answers = Record<Field | "otherPurpose", string>;

export const minimumMonthlyIncome = 10_000;
export const minimumLoanAmount = 1000;
const inr = new Intl.NumberFormat("en-IN");
export const incomeMinimumHint = "Minimum monthly income: ₹" + inr.format(minimumMonthlyIncome) + ".";
export const amountMinimumHint = "Minimum loan amount: ₹" + inr.format(minimumLoanAmount) + ".";

export const fields: Record<Field, { label: string; type?: string; options?: string[] }> = {
  name: { label: "Full name" },
  email: { label: "Email address", type: "email" },
  employment: { label: "Employment status", options: ["Employed", "Self-employed", "Unemployed", "Student", "Retired"] },
  income: { label: "Monthly income (INR)", type: "number" },
  amount: { label: "Loan amount (INR)", type: "number" },
  purpose: { label: "Loan purpose", options: ["Debt consolidation", "Home improvement", "Education", "Other"] },
};

export const initialAnswers: Answers = { name: "", email: "", employment: "", income: "", amount: "", purpose: "", otherPurpose: "" };
export const allFields = sections.flatMap((section) => [...section.fields]);


export type LayoutStep = { title: string; description: string; fields: readonly Field[] };

export function sectionFor(field: Field, layout: readonly LayoutStep[] = sections) {
  return layout.findIndex((section) => section.fields.includes(field));
}

export function parseLayout(value: unknown, target: Field): LayoutStep[] | null {
  if (!value || typeof value !== "object" || !("steps" in value) ||
      !Array.isArray(value.steps) || value.steps.length > allFields.length) return null;

  const remaining = new Set<string>(allFields);
  const steps: LayoutStep[] = [];
  for (const step of value.steps) {
    if (!step || typeof step.title !== "string" || !step.title.trim() || step.title.length > 60 ||
        typeof step.description !== "string" || !step.description.trim() || step.description.length > 200 ||
        !Array.isArray(step.fields) || !step.fields.length) return null;

    const ids: Field[] = [];
    for (const id of step.fields) {
      if (typeof id !== "string" || !remaining.delete(id)) return null;
      ids.push(id as Field);
    }
    steps.push({ title: step.title, description: step.description, fields: ids });
  }
  return remaining.size === 0 &&
    steps.some((step) => step.fields.length === 1 && step.fields[0] === target) ? steps : null;
}


export const validationMessages = {
  required: "This field is required.",
  invalid_name: "Enter a name using letters, without numbers.",
  invalid_email: "Enter a valid email address.",
  invalid_income: incomeMinimumHint,
  invalid_amount: amountMinimumHint,
  missing_other_purpose: "Describe your loan purpose."
};

export type ValidationCode = keyof typeof validationMessages;

export function validateField(field: Field, answers: Answers): ValidationCode | undefined {
  const value = answers[field].trim();
  if (!value) return "required";
  if (field === "name" && !/^\p{L}[\p{L}\p{M}\p{Pd}\p{Zs}.'’]*$/u.test(value)) {
    return "invalid_name";
  }
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "invalid_email";
  }
  if (field === "income" && (!Number.isFinite(Number(value)) || Number(value) < minimumMonthlyIncome)) {
    return "invalid_income";
  }
  if (field === "amount" && (!Number.isFinite(Number(value)) || Number(value) < minimumLoanAmount)) {
    return "invalid_amount";
  }
  if (field === "purpose" && value === "Other" && !answers.otherPurpose.trim()) {
    return "missing_other_purpose";
  }
}

export function nextCorrection(answers: Answers, current?: Field) {
  if (current && validateField(current, answers)) return current;
  return allFields.find((field) => validateField(field, answers));
}

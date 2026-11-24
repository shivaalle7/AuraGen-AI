import assert from "node:assert/strict";
import test from "node:test";
import { initialAnswers, minimumLoanAmount, minimumMonthlyIncome, nextCorrection, parseLayout, sectionFor, validateField } from "../src/app/loan-layout.ts";

function incomeGuide() {
  return {
    steps: [
      { title: "Applicant", description: "Enter your contact details.", fields: ["name", "email"] },
      { title: "Employment", description: "Select your employment status.", fields: ["employment"] },
      { title: "Monthly income", description: "Enter zero or more in INR.", fields: ["income"] },
      { title: "Loan request", description: "Enter your loan details.", fields: ["amount", "purpose"] },
    ],
  };
}

test("accepts a complete guide and finds the triggering field's step", () => {
  const guide = incomeGuide();
  const steps = parseLayout(guide, "income");
  assert.deepEqual(steps, guide.steps);
  assert.equal(sectionFor("income", steps), 2);
});

test("rejects a guide that omits a required field", () => {
  const guide = incomeGuide();
  guide.steps[3].fields.pop();
  assert.equal(parseLayout(guide, "income"), null);
});

test("rejects duplicate and unrecognized field IDs", () => {
  for (const invalidId of ["income", "bankAccount"]) {
    const guide = incomeGuide();
    guide.steps[3].fields.push(invalidId);
    assert.equal(parseLayout(guide, "income"), null);
  }
});

test("rejects a guide that groups the triggering field with another field", () => {
  const guide = incomeGuide();
  guide.steps[1].fields.push("income");
  guide.steps.splice(2, 1);
  assert.equal(parseLayout(guide, "income"), null);
});

test("rejects malformed steps and invalid helper text", () => {
  assert.equal(parseLayout({ steps: [null] }, "income"), null);
  for (const description of [" ", "x".repeat(201)]) {
    const guide = incomeGuide();
    guide.steps[2].description = description;
    assert.equal(parseLayout(guide, "income"), null);
  }
});

test("income and loan amount accept the exact demo minimum", () => {
  for (const [field, minimum, error] of [
    ["income", minimumMonthlyIncome, "invalid_income"],
    ["amount", minimumLoanAmount, "invalid_amount"],
  ]) {
    assert.equal(validateField(field, { ...initialAnswers, [field]: String(minimum - 1) }), error);
    assert.equal(validateField(field, { ...initialAnswers, [field]: String(minimum) }), undefined);
  }
});

test("Other requires a nonblank loan purpose description", () => {
  const answers = { ...initialAnswers, purpose: "Other", otherPurpose: "   " };
  assert.equal(validateField("purpose", answers), "missing_other_purpose");
  assert.equal(validateField("purpose", { ...answers, otherPurpose: "Replace a broken appliance" }), undefined);
  assert.equal(validateField("purpose", { ...answers, purpose: "Education" }), undefined);
});

test("corrects income before loan amount even if the generated layout puts loan amount first", () => {
  const { steps } = incomeGuide();
  const reordered = [steps[3], ...steps.slice(0, 3)];
  const parsed = parseLayout({ steps: reordered }, "income");
  assert.ok(parsed);
  const answers = {
    ...initialAnswers,
    name: "Avery Demo",
    email: "avery@example.com",
    employment: "Employed",
    income: "9999",
    amount: "999",
    purpose: "Education",
  };

  assert.equal(nextCorrection(answers), "income");
  assert.equal(sectionFor(nextCorrection(answers), parsed), 3);
  assert.equal(nextCorrection(answers, "income"), "income");
  answers.income = String(minimumMonthlyIncome);
  assert.equal(nextCorrection(answers, "income"), "amount");
  assert.equal(sectionFor(nextCorrection(answers, "income"), parsed), 0);
  answers.amount = String(minimumLoanAmount);
  assert.equal(nextCorrection(answers, "amount"), undefined);
});

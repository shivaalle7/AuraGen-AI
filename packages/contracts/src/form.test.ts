import { describe, expect, it } from "vitest";
import { financialFormSchema, parseFormValues } from "./index.js";
const valid = {fullName: "Demo User", monthlyIncome: 25000, loanAmount: 100000};
describe("financial form contract", () => {
  it("normalizes surrounding whitespace", () => expect(financialFormSchema.parse({...valid, fullName: "  Demo User  "}).fullName).toBe("Demo User"));
  it.each([0, -1, Infinity, NaN, 100000001])("rejects unsupported income %s", monthlyIncome => {
    expect(financialFormSchema.safeParse({...valid, monthlyIncome}).success).toBe(false);
  });
  it("rejects extra request fields", () => expect(financialFormSchema.safeParse({...valid, secret: "x"}).success).toBe(false));
  it.each(["", " ", "100abc"])("rejects empty or partial numeric input %s", monthlyIncome => {
    expect(parseFormValues({fullName: "Demo User", monthlyIncome, loanAmount: "100000"}).success).toBe(false);
  });
  it("accepts decimal currency amounts", () => expect(parseFormValues({fullName: "Demo User", monthlyIncome: "25000.50", loanAmount: "100000"}).success).toBe(true));
});
it("accepts a partial API field-error response", async () => {
  const {apiErrorSchema} = await import("./index.js");
  expect(apiErrorSchema.safeParse({error: {code: "VALIDATION_ERROR", message: "Check fields", fields: {monthlyIncome: "Invalid income"}}}).success).toBe(true);
});

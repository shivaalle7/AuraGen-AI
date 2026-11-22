import { z } from "zod";
export const fieldIds = ["fullName", "monthlyIncome", "loanAmount"] as const;
export const uiSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(100),
  description: z.string().max(400),
  fields: z.array(z.object({
    id: z.enum(fieldIds), label: z.string().min(1).max(80),
    component: z.enum(["text", "number"]), help: z.string().max(200)
  }).strict()).length(3)
}).strict().superRefine((spec, ctx) => {
  if (new Set(spec.fields.map(f => f.id)).size !== fieldIds.length)
    ctx.addIssue({code: "custom", message: "Every supported field must appear exactly once"});
  for (const field of spec.fields) {
    if (field.component !== (field.id === "fullName" ? "text" : "number"))
      ctx.addIssue({code: "custom", message: "Field component type mismatch"});
  }
});
export type UISpec = z.infer<typeof uiSpecSchema>;
export const mockSpec: UISpec = uiSpecSchema.parse({version: 1, title: "Let’s take this one step at a time", description: "Enter your details below. Your entries stay in this form while the layout changes.", fields: [
  {id: "fullName", label: "Your full name", component: "text", help: "Use the name on your application."},
  {id: "monthlyIncome", label: "Monthly income", component: "number", help: "Enter your monthly income in rupees."},
  {id: "loanAmount", label: "Amount you need", component: "number", help: "Enter your requested loan in rupees."}
]});

export const financialFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Use 100 characters or fewer."),
  monthlyIncome: z.number().finite().min(1, "Income must be greater than zero.").max(100_000_000, "Income exceeds the supported limit."),
  loanAmount: z.number().finite().min(1, "Loan amount must be greater than zero.").max(1_000_000_000, "Loan amount exceeds the supported limit.")
}).strict();
export type FinancialForm = z.infer<typeof financialFormSchema>;
export type FieldErrors = Partial<Record<typeof fieldIds[number], string>>;
export function getFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const id = issue.path[0];
    if (typeof id === "string" && fieldIds.includes(id as typeof fieldIds[number]) && !fields[id as typeof fieldIds[number]]) {
      fields[id as typeof fieldIds[number]] = issue.message;
    }
  }
  return fields;
}
// Never coerce empty browser inputs to zero or accept partially parsed numbers.
export function parseFormValues(values: Record<typeof fieldIds[number], string>) {
  const numeric = (value: string) => value.trim() === "" ? undefined : Number(value);
  return financialFormSchema.safeParse({fullName: values.fullName, monthlyIncome: numeric(values.monthlyIncome), loanAmount: numeric(values.loanAmount)});
}
export const generationRequestSchema = z.object({
  formId: z.literal("financial-application").default("financial-application"),
  reason: z.enum(["manual", "friction"]).default("manual")
}).strict();
export const apiErrorSchema = z.object({error: z.object({
  code: z.enum(["VALIDATION_ERROR", "INVALID_JSON", "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "NOT_FOUND", "INTERNAL_ERROR"]),
  message: z.string(),
  fields: z.partialRecord(z.enum(fieldIds), z.string()).optional()
}).strict()}).strict();
export const generationResponseSchema = z.object({mode: z.literal("mock"), spec: uiSpecSchema}).strict();

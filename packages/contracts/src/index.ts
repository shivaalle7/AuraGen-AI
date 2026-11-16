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
export const mockSpec: UISpec = uiSpecSchema.parse({version: 1, title: "Let’s take this one step at a time", description: "Enter your details below. Your information stays in this browser session.", fields: [
  {id: "fullName", label: "Your full name", component: "text", help: "Use the name on your application."},
  {id: "monthlyIncome", label: "Monthly income", component: "number", help: "Enter your monthly income in rupees."},
  {id: "loanAmount", label: "Amount you need", component: "number", help: "Enter your requested loan in rupees."}
]});

import { setTimeout as delay } from "node:timers/promises";
import { allFields, fields, parseLayout, sections, type Field, type LayoutStep } from "../../loan-layout";

const errorCodes: Partial<Record<Field, string>> = {
  email: "invalid_email",
  income: "invalid_income",
  amount: "invalid_amount",
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "fields"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          fields: { type: "array", items: { type: "string", enum: allFields } },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = await request.text();
    if (body.length > 256) return Response.json({ error: "Invalid request" }, { status: 400 });
    const event = JSON.parse(body);
    if (!event || Object.keys(event).length !== 3 || !allFields.includes(event.fieldId) ||
        !Number.isSafeInteger(event.repeatCount) || event.repeatCount < 3 ||
        typeof event.errorCode !== "string" ||
        (event.errorCode !== "required" && event.errorCode !== errorCodes[event.fieldId as Field])) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (process.env.NODE_ENV === "development" && new URL(request.url).searchParams.get("demo") === "timeout") {
      await delay(3500, undefined, { signal: request.signal });
    }

    const fieldId: Field = event.fieldId;
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.AURAGEN_OPENAI_MODEL;
    let result: unknown;
    if (key && model) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(2200)]),
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 700,
          instructions: "Create guided steps for a demo loan form. Put the target field alone in a step. Include all fields exactly once. Use short plain-text titles (60 chars max) and practical descriptions (200 chars max). Only explain what to enter. Never give lending advice or ask for extra information. Income must be zero or more. Loan amount must be positive. Both are INR.",
          input: JSON.stringify({ fieldId, errorCode: event.errorCode, repeatCount: event.repeatCount, fields }),
          text: { format: { type: "json_schema", name: "guided_layout", strict: true, schema } },
        }),
      });
      if (!response.ok) return Response.json({ error: "Layout unavailable" }, { status: 502 });
      const data = await response.json();
      const output = data.output?.find((item: { type: string }) => item.type === "message")
        ?.content?.find((item: { type: string }) => item.type === "output_text");
      if (data.status !== "completed" || typeof output?.text !== "string") {
        return Response.json({ error: "Layout unavailable" }, { status: 502 });
      }
      result = JSON.parse(output.text);
    } else {
      result = {
        steps: sections.flatMap<LayoutStep>((section) => {
          const ids: readonly Field[] = section.fields;
          if (!ids.includes(fieldId)) return [section];
          return [
            { ...section, fields: ids.filter((id) => id !== fieldId) },
            {
              title: fields[fieldId].label,
              description: fieldId === "income" ? "Enter your monthly income in INR. Enter 0 if you have no monthly income."
                : fieldId === "amount" ? "Enter the amount you want to borrow in INR. Use a value greater than zero."
                  : "Complete this field to continue. " + (fieldId === "email" ? "Use an address such as name@example.com." : ""),
              fields: [fieldId],
            },
          ];
        }),
      };
    }

    const steps = parseLayout(result, fieldId);
    if (!steps) return Response.json({ error: "Layout unavailable" }, { status: 502 });
    return Response.json({ steps, source: key && model ? "model" : "simulated" });
  } catch {
    return Response.json({ error: "Layout unavailable" }, { status: 502 });
  }
}

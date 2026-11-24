import { setTimeout as delay } from "node:timers/promises";
import { allFields, fields, parseLayout, sections, incomeMinimumHint, amountMinimumHint, type Field, type LayoutStep } from "../../loan-layout";

const errorCodes: Partial<Record<Field, string>> = {
  name: "invalid_name",
  email: "invalid_email",
  income: "invalid_income",
  amount: "invalid_amount",
  purpose: "missing_other_purpose",
};

let liveAttempts = 0;
// Requests can only use known field IDs and error codes, keeping the cache bounded.
const modelLayouts = new Map<string, LayoutStep[]>();

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

    const demo = process.env.NODE_ENV === "development" ? new URL(request.url).searchParams.get("demo") : null;
    if (demo === "timeout") {
      await delay(3500, undefined, { signal: request.signal });
      return Response.json({ error: "Demo timeout" }, { status: 504 });
    }

    const fieldId: Field = event.fieldId;
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.AURAGEN_OPENAI_MODEL;
    const cacheKey = fieldId + ":" + event.errorCode;
    const cachedSteps = demo === "simulated" ? undefined : modelLayouts.get(cacheKey);
    if (cachedSteps) return Response.json({ steps: cachedSteps, source: "cached" });

    let result: unknown;
    const maxLiveCalls = Number(process.env.AURAGEN_OPENAI_MAX_CALLS ?? "0");
    const useLiveModel = demo !== "simulated" && Boolean(key && model) && Number.isSafeInteger(maxLiveCalls) &&
      maxLiveCalls > 0 && liveAttempts < maxLiveCalls;
    if (useLiveModel) {
      // Reserve an attempt before the request so concurrent requests share the same limit.
      liveAttempts += 1;
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 450,
          ...(model === "gpt-6-luna" ? { reasoning: { effort: "none" } } : {}),
          instructions: "Create guided steps for a demo loan form. Put the target field alone in a step. Include all fields exactly once. Use short plain-text titles (60 chars max) and practical descriptions (200 chars max). Only explain what to enter. Never give lending advice or ask for extra information. Names use letters without numbers. Both amounts are in INR. If loan purpose is Other, the existing form asks for a description. " + incomeMinimumHint + " " + amountMinimumHint,
          input: JSON.stringify({ fieldId, errorCode: event.errorCode, fields }),
          text: { format: { type: "json_schema", name: "guided_layout", strict: true, schema } },
        }),
      });
      if (!response.ok) {
        console.warn("AuraGen live layout provider returned HTTP", response.status);
        return Response.json({ error: "Layout unavailable" }, { status: 502 });
      }
      const data = await response.json();
      const output = data.output?.find((item: { type: string }) => item.type === "message")
        ?.content?.find((item: { type: string }) => item.type === "output_text");
      if (data.status !== "completed" || typeof output?.text !== "string") {
        console.warn("AuraGen live layout did not return a completed JSON response.");
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
              description: fieldId === "income" ? incomeMinimumHint
                : fieldId === "amount" ? amountMinimumHint
                  : fieldId === "purpose" ? "Select a purpose. If you choose Other, describe your purpose." : "Complete this field to continue. " + (fieldId === "email" ? "Use an address such as name@example.com." : ""),
              fields: [fieldId],
            },
          ];
        }),
      };
    }

    const steps = parseLayout(result, fieldId);
    if (!steps) {
      if (useLiveModel) console.warn("AuraGen live layout failed application validation.");
      return Response.json({ error: "Layout unavailable" }, { status: 502 });
    }
    if (useLiveModel) modelLayouts.set(cacheKey, steps);
    return Response.json({ steps, source: useLiveModel ? "model" : "simulated" });
  } catch (error) {
    if (!request.signal.aborted) {
      if (error instanceof Error && error.name === "TimeoutError") {
        console.warn("AuraGen live layout exceeded the provider timeout.");
      } else {
        console.warn("AuraGen layout request failed before a valid layout was returned.");
      }
    }
    return Response.json({ error: "Layout unavailable" }, { status: 502 });
  }
}

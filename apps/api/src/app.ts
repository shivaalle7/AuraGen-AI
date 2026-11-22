import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import cors from "cors";
import { financialFormSchema, generationRequestSchema, generationResponseSchema, getFieldErrors, mockSpec } from "@auragen/contracts";

export function createApp(origin = "http://localhost:3000") {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({origin}));
  app.use(express.json({limit: "8kb"}));
  app.get("/health", (_req, res) => res.json({status: "ok", generationMode: "mock"}));
  const requireJson: RequestHandler = (req, res, next) => {
    if (!req.is("application/json")) {
      res.status(415).json({error: {code: "UNSUPPORTED_MEDIA_TYPE", message: "Use application/json."}});
      return;
    }
    next();
  };
  app.post("/api/form/validate", requireJson, (req, res) => {
    const parsed = financialFormSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({error: {code: "VALIDATION_ERROR", message: "Check the form fields.", fields: getFieldErrors(parsed.error)}});
      return;
    }
    // Validation only: never persist, log, echo, or send financial values to a model.
    res.json({valid: true});
  });
  app.post("/api/ui/generate", (req, res) => {
    const parsed = generationRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json({error: {code: "VALIDATION_ERROR", message: "Invalid generation context."}});
      return;
    }
    res.json(generationResponseSchema.parse({mode: "mock", spec: mockSpec}));
  });
  app.use((_req, res) => res.status(404).json({error: {code: "NOT_FOUND", message: "Endpoint not found."}}));
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const type = typeof error === "object" && error !== null && "type" in error ? error.type : undefined;
    if (type === "entity.too.large") {
      res.status(413).json({error: {code: "PAYLOAD_TOO_LARGE", message: "Request exceeds the 8 KB limit."}});
    } else if (type === "entity.parse.failed") {
      res.status(400).json({error: {code: "INVALID_JSON", message: "Request body must be valid JSON."}});
    } else {
      res.status(500).json({error: {code: "INTERNAL_ERROR", message: "Request could not be completed."}});
    }
  };
  app.use(handleError);
  return app;
}

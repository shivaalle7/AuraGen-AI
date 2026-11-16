import express from "express";
import cors from "cors";
import { mockSpec, uiSpecSchema } from "@auragen/contracts";
export function createApp(origin = "http://localhost:3000") {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({origin}));
  app.use(express.json({limit: "8kb"}));
  app.get("/health", (_req, res) => res.json({status: "ok", generationMode: "mock"}));
  // Day 1 fixture: no form values are sent to a model or retained by the server.
  app.post("/api/ui/generate", (_req, res) => res.json({mode: "mock", spec: uiSpecSchema.parse(mockSpec)}));
  return app;
}

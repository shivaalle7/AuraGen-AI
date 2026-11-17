import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { uiSpecSchema } from "@auragen/contracts";
const server = createServer(createApp());
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it("reports mock mode and returns a validated specification", async () => {
  expect(await (await fetch(`${base}/health`)).json()).toEqual({status: "ok", generationMode: "mock"});
  const response = await fetch(`${base}/api/ui/generate`, {method: "POST"});
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.mode).toBe("mock");
  expect(uiSpecSchema.safeParse(result.spec).success).toBe(true);
});
it("rejects oversized JSON requests", async () => {
  const response = await fetch(`${base}/api/ui/generate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({data: "x".repeat(9000)})});
  expect(response.status).toBe(413);
});
it("validates form fields without returning financial values", async () => {
  const response = await fetch(`${base}/api/form/validate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({fullName: "Demo User", monthlyIncome: 25000, loanAmount: 100000})});
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({valid: true});
});
it("returns field errors for invalid financial values", async () => {
  const response = await fetch(`${base}/api/form/validate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({fullName: " ", monthlyIncome: -1, loanAmount: "100"})});
  expect(response.status).toBe(422);
  const {error} = await response.json();
  expect(Object.keys(error.fields).sort()).toEqual(["fullName", "loanAmount", "monthlyIncome"]);
});
it("rejects malformed JSON with a safe JSON error", async () => {
  const response = await fetch(`${base}/api/form/validate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: '{"fullName":'});
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({error: {code: "INVALID_JSON", message: "Request body must be valid JSON."}});
});
it("rejects non-JSON validation input", async () => {
  const response = await fetch(`${base}/api/form/validate`, {method: "POST", body: "name=Demo"});
  expect(response.status).toBe(415);
});
it("rejects financial data in generation context", async () => {
  const response = await fetch(`${base}/api/ui/generate`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({fullName: "Private Person"})});
  expect(response.status).toBe(422);
});
it("returns a consistent missing-endpoint error", async () => {
  const response = await fetch(`${base}/missing`);
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe("NOT_FOUND");
});

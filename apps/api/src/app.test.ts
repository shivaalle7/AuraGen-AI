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

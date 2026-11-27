import assert from "node:assert/strict";
import test from "node:test";
import { readGuideBody } from "../src/app/api/guided-layout/guide-body.ts";

const endpoint = "http://localhost:3000/api/guided-layout";

function request(body, headers = { "content-type": "application/json" }) {
  return new Request(endpoint, { method: "POST", body, headers, duplex: "half" });
}

test("accepts a 256-byte JSON body and media type parameters", async () => {
  const body = JSON.stringify({ fieldId: "income", errorCode: "invalid_income", repeatCount: 2 });
  const result = await readGuideBody(request(body.padEnd(256), { "content-type": "application/json; charset=utf-8" }));
  assert.deepEqual(result, { ok: true, value: JSON.parse(body) });
});

test("rejects unsupported media and malformed JSON as client errors", async () => {
  assert.equal((await readGuideBody(request("{}", { "content-type": "text/plain" }))).status, 415);
  assert.equal((await readGuideBody(request("{"))).status, 400);
  assert.equal((await readGuideBody(request(new Uint8Array([0xff])))).status, 400);
});

test("rejects an oversized declared body", async () => {
  const result = await readGuideBody(request("{}", {
    "content-type": "application/json",
    "content-length": "257",
  }));
  assert.equal(result.status, 413);
});

test("counts streamed bytes and cancels an oversized body without reading subsequent chunks", async () => {
  const encoder = new TextEncoder();
  let chunksRead = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      chunksRead++;
      controller.enqueue(encoder.encode(chunksRead === 1 ? " " : "é".repeat(128)));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });

  const result = await readGuideBody(request(body, {
    "content-type": "application/json",
    "content-length": "1",
  }));
  assert.equal(result.status, 413);
  assert.equal(chunksRead, 2);
  assert.equal(cancelled, true);
});

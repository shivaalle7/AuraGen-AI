const maxGuideBodyBytes = 256;

type GuideBody =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; message: string };

export async function readGuideBody(request: Request): Promise<GuideBody> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, status: 415, message: "Use application/json" };
  }

  const advertisedSize = Number(request.headers.get("content-length"));
  if (advertisedSize > maxGuideBodyBytes) {
    return { ok: false, status: 413, message: "Request body is too large" };
  }
  if (!request.body) return { ok: false, status: 400, message: "Invalid JSON" };

  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxGuideBodyBytes);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > buffer.length - length) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, message: "Request body is too large" };
      }
      buffer.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }
}

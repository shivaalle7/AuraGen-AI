import { WebSocketServer } from "ws";

const port = 3001;
const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
const fieldIds = new Set(["name", "email", "employment", "income", "amount", "purpose"]);
const fieldErrorCodes = new Map([
  ["email", "invalid_email"],
  ["income", "invalid_income"],
  ["amount", "invalid_amount"],
]);

const server = new WebSocketServer({
  host: "127.0.0.1",
  port,
  path: "/telemetry",
  maxPayload: 512,
  verifyClient: ({ origin }) => origins.has(origin),
});

server.on("listening", () => console.log(`AuraGen telemetry listening on ws://127.0.0.1:${port}/telemetry`));
server.on("error", (error) => {
  console.error("Telemetry server failed:", error.message);
  process.exitCode = 1;
});

server.on("connection", (socket) => {
  socket.on("error", () => socket.terminate());
  socket.on("message", (data, binary) => {
    try {
      const event = binary ? null : JSON.parse(data.toString());
      if (!event || event.type !== "validation_failure" ||
        Object.keys(event).length !== 4 || !fieldIds.has(event.fieldId) ||
        (event.errorCode !== "required" && event.errorCode !== fieldErrorCodes.get(event.fieldId)) ||
        typeof event.errorCode !== "string" ||
        !Number.isSafeInteger(event.repeatCount) || event.repeatCount < 1) {
        socket.close(1008, "Invalid telemetry event");
        return;
      }

      console.log(JSON.stringify({
        type: event.type,
        fieldId: event.fieldId,
        errorCode: event.errorCode,
        repeatCount: event.repeatCount,
      }));
    } catch {
      socket.close(1008, "Invalid telemetry event");
    }
  });
});

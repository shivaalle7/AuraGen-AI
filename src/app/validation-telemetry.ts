import { useEffect, useRef } from "react";

export const validationMessages = {
  required: "This field is required.",
  invalid_email: "Enter a valid email address.",
  invalid_income: "Enter a monthly income of zero or more.",
  invalid_amount: "Enter a loan amount greater than zero.",
};

export type ValidationCode = keyof typeof validationMessages;

const endpoint = "ws://127.0.0.1:3001/telemetry";

export function useValidationTelemetry() {
  const connection = useRef<WebSocket | null>(null);

  useEffect(() => {
    // This receiver is only available on the local development machine.
    if (window.location.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(window.location.hostname) ||
      window.location.port !== "3000") return;

    let retry: number | undefined;
    let stopped = false;
    let delay = 1_000;

    function connect() {
      const socket = new WebSocket(endpoint);
      connection.current = socket;
      socket.onopen = () => { delay = 1_000; };
      socket.onclose = () => {
        if (stopped) return;
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15_000);
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      connection.current?.close();
      connection.current = null;
    };
  }, []);

  return function sendValidationFailure(fieldId: string, errorCode: ValidationCode, repeatCount: number) {
    const socket = connection.current;
    if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 4_096) return;
    socket.send(JSON.stringify({ type: "validation_failure", fieldId, errorCode, repeatCount }));
  };
}

# AuraGen-AI

AuraGen is an adaptive UI demo that detects repeated validation failures in a fictional loan application and offers a guided layout tailored to the affected field. Both views share answers and validation.

## Run locally

Use Node.js 22.13 or newer on the Node 22 release line.

```powershell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000/). To see validation metadata over WebSockets, run `npm run dev:telemetry` in a second terminal.

## Demo

1. Enter `-10` for **Monthly income (INR)** and click **Submit demo application** three times within 30 seconds.
2. Click **Open guided section** to see the tailored step. Edit the income and return to standard view to confirm the edit carries over.
3. In development, open [the timeout demo](http://localhost:3000/?layoutDemo=timeout) and repeat the same steps to see the built-in guide open at Finances.

The layout uses simulated generation by default. The optional live provider reads `OPENAI_API_KEY` and `AURAGEN_OPENAI_MODEL` from `.env.local`. Form answers remain in the browser. The server receives the affected field ID, error code, and repeat count, and validates that the layout contains each required field exactly once. Live provider verification is pending.

## Checks

```powershell
npm run lint
npx tsc --noEmit
```

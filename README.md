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
2. Click **Open guided section** to see the tailored step. Correct the income and click **Continue**. The guide moves to any remaining invalid field, then returns to standard view with your corrections.
3. In development, open [the timeout demo](http://localhost:3000/?layoutDemo=timeout) and repeat the same steps to see the built-in guide open at Finances.

The layout uses simulated generation by default and makes no paid calls. To run a small live test, add these settings to the Git-ignored `.env.local` file and restart Next.js.

```dotenv
OPENAI_API_KEY=your_key_here
AURAGEN_OPENAI_MODEL=gpt-6-luna
AURAGEN_OPENAI_MAX_CALLS=5
```

Each server process allows up to five live attempts with this configuration. Failed and timed-out requests count toward the limit. After the limit, AuraGen uses simulated layouts. The counter resets on restart or during development reloads and applies separately to each server process. Set the limit to `0` to disable paid calls.

Form answers stay in the browser. The server receives the affected field ID, error code, and repeat count. The layout validator checks that every field appears exactly once.

## Checks

```powershell
npm run lint
npx tsc --noEmit
```

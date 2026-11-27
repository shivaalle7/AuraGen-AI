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

For a no-cost rehearsal, open the [simulated demo](http://localhost:3000/?layoutDemo=simulated). In development, this link always uses fresh simulated guides, even when a live API key or cached AI guide is available.

1. Click **Load sample application** in the empty form, then click **Submit demo application** twice within 30 seconds.
2. Click **Open guided section** to see the tailored step. Correct the income to ₹10,000 and click **Continue**. Correct the loan amount to ₹1,000 and click **Continue** again to return to standard view with both corrections.
3. In development, open [the timeout demo](http://localhost:3000/?layoutDemo=timeout) and repeat the same steps to see the built-in guide open at Finances.

Select **Use built-in guide** on the offer to open it immediately without a model call. You can also switch while generation is pending. The browser cancels the request, although a live attempt that already started still counts toward the limit.

Open **Adaptation diagnostics** to see the trigger, layout source, and elapsed time for each recent run from accepting the offer until the layout is ready. The panel compares that time with the two-second target. It keeps the five most recent runs in the browser tab. Select **Download CSV** to export those runs as diagnostic metadata. The CSV includes one row per field error present when you accept the guide, with the triggering field marked. The trigger row includes the time from the first to the latest failed submission. It excludes form answers.

The layout uses simulated generation by default and makes no paid calls. To run a small live test, add these settings to the Git-ignored `.env.local` file and restart Next.js.

```dotenv
OPENAI_API_KEY=your_key_here
AURAGEN_OPENAI_MODEL=gpt-6-luna
AURAGEN_OPENAI_MAX_CALLS=5
```

Each server process allows up to five live attempts with this configuration. Failed and timed-out requests count toward the limit. AuraGen caches validated AI layouts by field and error for the lifetime of the server process. A repeat can reuse the cached guide without spending an attempt. Once the limit is reached, uncached cases use simulated layouts. The counter resets on restart or during development reloads and applies separately to each server process. Set the limit to `0` to disable paid calls.

Form answers stay in the browser. The server receives the affected field ID, error code, and repeat count. The layout validator checks that every field appears exactly once.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
```

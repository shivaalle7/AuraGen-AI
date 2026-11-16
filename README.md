# AuraGen — Adaptive UI via Cognitive Friction

Infotact Solutions internship · two-member team · development November 17–December 7, 2026; evaluation December 8–14.

## Run locally

Requires Node.js 24 and npm 11. From the repository root:

```sh
npm ci
cp .env.example .env
npm run dev:api
# In a second terminal
npm run dev:web
```

Visit http://localhost:3000. API health: http://localhost:4000/health.
For a custom frontend API URL, place NEXT_PUBLIC_API_URL in apps/web/.env.local (Next.js reads app-local environment files).

```sh
npm run typecheck
npm test
npm run build
```

## Current functionality

Day 1 foundation: Next.js financial form, Express API, Socket.IO readiness event, strict shared Zod layout contract, manual mock simplification, browser-held form values, failure message, and CI configuration. No real financial submission is performed. Automatic telemetry, cognitive scoring, live LangChain/OpenAI generation, and deployment are pending.

No generated JavaScript is executed. JSON describes only allowed input components. No API key is needed for mock mode. Never place credentials in NEXT_PUBLIC variables.

See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [daily progress](docs/DAILY_PROGRESS.md).

## Browser smoke check

With both servers running, run `npx playwright install chromium`, then `npm run test:browser`. Set CHROMIUM_PATH when using a system browser. This checks mock adaptation, all three field values, failure recovery, and mobile overflow. Browser execution was blocked by operating-system permissions in the initial Work environment; it is not recorded as passed.

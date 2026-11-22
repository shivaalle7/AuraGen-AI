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

## Current functionality (Day 2)

Next.js financial form with shared client/server validation, accessible field errors, first-invalid-field focus, bounded numeric inputs, validation API, consistent JSON errors, strict generation context, Socket.IO readiness event, manual mock simplification, browser-held state and CI configuration. Validation sends form values transiently to the API; the app does not store them or send them to a model. No loan application is submitted. Automatic telemetry, cognitive scoring, live LangChain/OpenAI generation, and deployment are pending.

No generated JavaScript is executed. JSON describes only allowed input components. No API key is needed for mock mode. Never place credentials in NEXT_PUBLIC variables.

See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [daily progress](docs/DAILY_PROGRESS.md).

## Browser smoke check

With both servers running, run `npx playwright install chromium`, then `npm run test:browser`. Set CHROMIUM_PATH when using a system browser. This checks mock adaptation, all three field values, failure recovery, and mobile overflow. Browser execution was blocked by operating-system permissions in the initial Work environment; it is not recorded as passed.

## Develop in VS Code

Open the repository root, install the recommended extensions you want, and run `npm ci`. Copy `.env.example` to `.env`. Use Terminal → Run Task → AuraGen: develop to start frontend and backend in parallel. Open http://localhost:3000. Use the typecheck, test and build tasks for validation.

For backend breakpoints, stop the backend task and launch “AuraGen: debug backend” from Run and Debug. Start the frontend task before launching “AuraGen: debug frontend in Edge”. Keep API keys only in ignored environment files.

The VS Code configuration is portable project setup, not evidence that the app has been opened on your personal computer.

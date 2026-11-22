# API — Day 2

Base URL: http://localhost:4000. Generation remains deterministic mock mode.

| Endpoint | Body | Success |
| --- | --- | --- |
| GET /health | None | {"status":"ok","generationMode":"mock"} |
| POST /api/form/validate | JSON financial form | {"valid":true} |
| POST /api/ui/generate | Optional JSON {"formId":"financial-application","reason":"manual"} | {"mode":"mock","spec": ...} |

Financial form: fullName is a trimmed string of 2–100 characters; monthlyIncome is a finite number from 1 to 100,000,000; loanAmount is a finite number from 1 to 1,000,000,000. Amounts are INR; decimals are supported. Limits are demo input bounds, not lending eligibility rules. Numeric strings and unknown fields are rejected by the API. Client-side empty amounts are invalid, not coerced to zero.

Form validation requires Content-Type: application/json. Form values are processed transiently; they are not persisted, echoed, logged by this application, or passed to a model. Deployment proxy logging must be configured separately before real use. This endpoint does not submit a loan application.

Generation accepts formId and reason (manual or friction) only. Financial values or other unknown properties are rejected. Empty requests remain compatible with the Day 1 demo.

## Error contract

All errors use {"error":{"code":"...","message":"...","fields":{...}}}. fields is present for form-validation failures and maps supported field IDs to error messages. Unknown root properties may yield an empty fields object.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_JSON | Malformed JSON |
| 413 | PAYLOAD_TOO_LARGE | JSON exceeds 8 KB |
| 415 | UNSUPPORTED_MEDIA_TYPE | Validation request is not JSON |
| 422 | VALIDATION_ERROR | Schema or field validation failed |
| 404 | NOT_FOUND | Unknown route |
| 500 | INTERNAL_ERROR | Generic unexpected failure; no stack or input disclosure |

CORS defaults to http://localhost:3000; it is not authentication. Hosted access and abuse controls are pending.

Socket.IO emits server:ready with version=1 and mode=mock. Telemetry remains scheduled for Day 3.

Layout specification v1 requires all three distinct fields: fullName (text), monthlyIncome (number), loanAmount (number). Unknown properties, components, missing or duplicated fields are rejected. React rendering never evaluates generated code.

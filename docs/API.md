# Day 1 API

Base URL: http://localhost:4000

| Endpoint | Result |
| --- | --- |
| GET /health | status=ok, generationMode=mock |
| POST /api/ui/generate | mode=mock, spec=validated UI specification |

The generation endpoint currently ignores input and returns a deterministic fixture; no live model integration exists. JSON request size is limited to 8 KB. CORS defaults to http://localhost:3000. CORS is not authentication; hosting is deferred until access and abuse controls are reviewed.

Socket.IO: server emits server:ready with version=1 and mode=mock after connection. Telemetry transport, payload validation and reconnection tests are planned for Day 3.

Specification version 1 requires exactly the three supported fields: fullName (text), monthlyIncome (number), loanAmount (number). Unknown properties, component types, repeated IDs and missing fields are rejected. Rendering uses normal React text and inputs without HTML injection or code evaluation.

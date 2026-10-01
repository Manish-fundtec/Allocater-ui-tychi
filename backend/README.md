# Tychi Allocator API

Standalone Node.js REST API for the **Tychi Allocator** module (FundTec). Replaces Next.js API routes in `tychi-allocator-ui/web/src/app/api/` when the UI points at this server.

## Stack

- **Node.js 20+**, **TypeScript**, **Express**
- **PostgreSQL** (`pg`, parameterized queries only)
- **Zod** validation, **dotenv**, **nodemailer**, **helmet**, **cors**, **winston**

## Setup

```bash
cd tychi-allocator
cp .env.example .env
# Edit DATABASE_URL and other vars
npm install
```

Run allocator migrations against the shared FundTec DB (after `funds` / `investors` exist):

```bash
psql $DATABASE_URL -f migrations/001_allocator.sql
```

## Run

```bash
npm run dev    # port 4000, hot reload
npm run build
npm run start
```

## Auth

All `/api/*` routes require auth except `GET /health`.

- `Authorization: Bearer <token>` — integration point for FundTec JWT verify (dev: any non-empty token)
- Cookie `fundtec_session` — integration point for FundTec session
- `DEV_AUTH_BYPASS=true` + `NODE_ENV=development` — mock user without credentials

## UI connection

In `tychi-allocator-ui/web/.env.local`:

```env
MOCK_UI=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Point UI fetches at the backend (Next.js rewrites or shared `api-client` with absolute base URL).

## Health

```bash
curl http://localhost:4000/health
```

## Example requests

Replace `FUND_ID` and `INVESTOR_ID` with real numeric IDs from `funds` / `investors`.

```bash
# Funds
curl -H "Authorization: Bearer dev" http://localhost:4000/api/funds

# Dashboard
curl -H "Authorization: Bearer dev" "http://localhost:4000/api/allocator/dashboard-stats?fundId=FUND_ID"

# Allocation preview
curl -X POST -H "Authorization: Bearer dev" -H "Content-Type: application/json" \
  -d '{"fundId":"FUND_ID","period":"2025-03","investorIds":["INVESTOR_ID"]}' \
  http://localhost:4000/api/allocator/allocation/preview

# Allocation run (transaction)
curl -X POST -H "Authorization: Bearer dev" -H "Content-Type: application/json" \
  -d '{"fundId":"FUND_ID","period":"2025-03","investorIds":["INVESTOR_ID"]}' \
  http://localhost:4000/api/allocator/allocation/run
```

## API endpoints (24)

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/api/funds` |
| GET | `/api/allocator/badges` |
| GET | `/api/allocator/dashboard-stats` |
| GET | `/api/allocator/allocation/history` |
| GET | `/api/allocator/allocation/investor-history` |
| GET | `/api/allocator/investors` |
| GET | `/api/allocator/investors/:id` |
| PATCH | `/api/allocator/investors/:id` |
| GET | `/api/allocator/nav/history` |
| GET | `/api/allocator/nav/all` |
| POST | `/api/allocator/nav/seed` |
| POST | `/api/allocator/nav/carry-forward` |
| GET | `/api/allocator/pl-reports` |
| POST | `/api/allocator/tychi/fetch-pl` |
| GET | `/api/allocator/tychi/import-history` |
| GET | `/api/allocator/tychi/test-connection` |
| GET | `/api/allocator/fees` |
| POST | `/api/allocator/fees` |
| POST | `/api/allocator/allocation/preview` |
| POST | `/api/allocator/allocation/run` |
| GET | `/api/allocator/reports/unsent` |
| GET | `/api/allocator/reports/all` |
| GET | `/api/allocator/reports/preview/:investorId` |
| POST | `/api/allocator/reports/send/:investorId` |
| POST | `/api/allocator/reports/send-all` |
| GET | `/api/allocator/settings` |
| POST | `/api/allocator/settings` |
| PUT | `/api/allocator/settings` |

## Project layout

```
src/
  index.ts, app.ts
  config/env.ts
  db/pool.ts, transaction.ts
  middleware/auth.ts, validate.ts, errorHandler.ts
  routes/, controllers/, services/, models/
  lib/allocation/calculations.ts
  lib/tychi/client.ts
  lib/email/navReport.ts
  lib/crypto/settings.ts
```

## Settings encryption

`allocator_settings` values are encrypted at rest (AES-256-GCM). Set `SETTINGS_ENCRYPTION_KEY` in production; wire KMS for key management in prod.

## Errors

JSON shape: `{ "error": "message" }` — 400 validation, 401 auth, 404 not found, 500 internal.

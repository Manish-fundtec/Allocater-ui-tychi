# Tychi Allocator UI

Next.js frontend and API routes for the **Tychi Allocator** module inside FundTec.

## Stack

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS v4
- Shadcn-style UI (Radix primitives)
- PostgreSQL via `pg`

## Quick start

```bash
cd web
cp .env.example .env.local
# Set DATABASE_URL to your FundTec PostgreSQL instance
npm install
npm run dev
```

Open [http://localhost:3000/allocator](http://localhost:3000/allocator).

## Database

Apply `migrations/001_allocator.sql` on the shared FundTec database (requires existing `funds` and `investors` tables).

## Routes

| Path | Description |
|------|-------------|
| `/allocator` | Dashboard |
| `/allocator/investors` | Investor list |
| `/allocator/pl-reports` | P&L reports |
| `/allocator/import` | Tychi GL import |
| `/allocator/nav` | NAV history |
| `/allocator/allocation/run` | Run allocation wizard |
| `/allocator/reports` | NAV email reports |
| `/allocator/fees` | Fee structure |
| `/allocator/settings` | Email & Tychi API settings |

API handlers live under `src/app/api/allocator/`.

## Backend repo

Optional separate backend: `tychi-allocator` — this UI embeds API routes in Next.js as specified.

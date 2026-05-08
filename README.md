# Via Mood Vendor Platform

Multi-vendor marketplace platform for the Via Mood Shopify store. Provides vendor dashboards, admin dashboards, order routing, payouts, and KargoLab fulfillment integration on top of Shopify storefront.

## Status

🚧 **Phase 0 — Foundation** (in progress)

See [`docs/MULTIVENDOR_PLAN.md`](./docs/MULTIVENDOR_PLAN.md) for the full plan and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for technical decisions.

## Stack

- **Web**: Next.js 15 (App Router) + React 19 + Tailwind 4 + shadcn/ui
- **DB**: PostgreSQL 16 + Drizzle ORM (migrations + studio)
- **Auth**: Auth.js (NextAuth v5) — email/pass, magic link, Google, Apple
- **Queue**: BullMQ + Redis
- **Shopify**: Admin API + webhook handlers
- **Payment**: Iyzico Pazaryeri (marketplace split) + cari mode
- **Fulfillment**: KargoLab API
- **Hosting**: Vercel + Railway/Fly.io worker

## Getting Started

### Prerequisites

- Node.js 20+
- Postgres 16+ (local docker or Supabase)
- Redis 7+ (local docker or Upstash)

### Setup

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env.local
# Edit .env.local with your secrets

# 3. Run DB migrations
npm run db:generate
npm run db:migrate

# 4. (Optional) Seed dev data
npm run db:seed

# 5. Start dev server
npm run dev
# → http://localhost:3000

# 6. Start worker (in separate terminal, for queue jobs)
npm run worker:dev
```

### Drizzle commands

```bash
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:push       # (dev only) Push schema directly without migration
npm run db:studio     # Open Drizzle Studio (DB GUI)
```

## Project Structure

```
vendor-platform/
├── docs/                          # Plan, architecture, ADRs
├── drizzle/                       # Generated migrations
├── src/
│   ├── app/                       # Next.js App Router routes
│   ├── db/
│   │   ├── schema/                # Drizzle schemas (split by domain)
│   │   ├── client.ts              # DB client + connection pool
│   │   └── seed.ts                # Dev seed data
│   ├── lib/                       # Shared business logic
│   │   ├── shopify/               # Shopify API client + webhook utils
│   │   ├── iyzico/                # Payment integration
│   │   ├── kargolab/              # Shipping integration
│   │   ├── routing/               # Order routing engine
│   │   ├── auth.ts                # Auth.js config
│   │   └── env.ts                 # Validated env vars (Zod)
│   └── worker/                    # BullMQ workers
└── tests/                         # Vitest + Playwright
```

## Roadmap

| Phase | Status |
|---|---|
| 0. Foundation | 🚧 In progress |
| 1. Vendor auth + onboarding | ⏳ Pending |
| 2. Vendor dashboard MVP | ⏳ Pending |
| 3. Order routing engine | ⏳ Pending |
| 4. Fulfillment workflow | ⏳ Pending |
| 5. Payment + payout | ⏳ Pending |
| 6. Polish + go-live | ⏳ Pending |

## License

Private / Proprietary — Via Glocal Dış Tic. Ltd. Şti.

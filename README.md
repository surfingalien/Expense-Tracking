# AI Expense Tracker

An expense-tracking web app with sign-in, AI receipt scanning, budgets and budget alerts, recurring expenses, income tracking, CSV import, an analytics dashboard, and PDF/CSV reports. Runs on Vercel with Neon Postgres, Clerk, Vercel Blob and the Vercel AI Gateway.

![stack](https://img.shields.io/badge/Next.js%2016-React%2019-10b981) ![db](https://img.shields.io/badge/Prisma%207-Postgres-2D3748) ![style](https://img.shields.io/badge/Tailwind%204-shadcn%2Fui-emerald)

## Features

- **Accounts** — sign in with Clerk; every user only sees their own data.
- **AI receipt scanning** — a photo is read by a vision model (default `google/gemini-3.5-flash` via the Vercel AI Gateway), which extracts merchant, date, line items, tax and total. You confirm before saving. The receipt image is kept in a private Vercel Blob store and only served to its owner.
- **Automatic categorization** — AI suggestion plus keyword rules map each expense to a category.
- **Dashboard** — KPIs, trend chart, category donut, budget bars, top merchants, income and net savings, and an alert banner when a category passes 80% / 100% of its budget.
- **Budgets & recurring expenses** — monthly limits per category; recurring rules (weekly / monthly / yearly) for rent, subscriptions and bills are logged automatically on their due dates.
- **Income** — record salary and other income to see net savings for any period.
- **CSV import** — import a bank export; columns are detected, deposits skipped and duplicates ignored.
- **Reports** — multi-page PDF report and CSV export.
- **Currency** — choose the display currency per user.
- **Installable** — web app manifest and icons, so it can be added to a phone's home screen.

## Tech stack

| Layer     | Choice                                                         |
| --------- | -------------------------------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript (type-checked on build)   |
| UI        | Tailwind CSS 4 + shadcn/ui + Recharts + lucide-react + sonner  |
| Auth      | Clerk (`@clerk/nextjs`)                                        |
| Data      | TanStack Query (client) + Prisma 7 with `@prisma/adapter-pg`   |
| Database  | Postgres (Neon via the Vercel Marketplace)                     |
| Files     | Vercel Blob (private) for receipt images                       |
| AI        | AI SDK + Vercel AI Gateway (vision model, structured output)   |
| Reports   | pdf-lib (vector PDF) + native CSV                              |

## Environment variables

| Variable | Set by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon integration | pooled (app) / direct (migrations) Postgres URLs |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk integration | sign-in |
| `BLOB_READ_WRITE_TOKEN` | Blob store connected to the project | receipt image storage (optional — scanning works without it, images just aren't kept) |
| `AI_GATEWAY_API_KEY` | you, **local dev only** | on Vercel the AI Gateway authenticates with the project's OIDC token automatically |
| `RECEIPT_SCAN_MODEL` | optional | override the vision model, e.g. `anthropic/claude-haiku-5.5` |
| `DEV_AUTH_BYPASS_USER_ID` | optional, local dev only | run `next dev` without Clerk as this user id; ignored in production builds |

On Vercel, pull them locally with `vercel env pull .env`.

## Getting started

```bash
bun install           # also runs prisma generate
bun run db:deploy     # apply migrations (prisma migrate deploy)
bun run dev           # http://localhost:3000
```

The first time a user signs in they get the default categories and 90 days of demo expenses (clear them under **Reports → Data management**). The first user to sign in also takes ownership of any data created before sign-in existed.

`bun run build` generates the Prisma client, applies pending migrations, then builds (with type checking). Run `bun run lint` before shipping changes.

## Project structure

```
prisma/schema.prisma            # UserSettings, Category, Expense, Income, RecurringExpense
prisma/migrations/              # Postgres migrations (applied on every build)
prisma.config.ts                # Prisma 7 CLI config (migration connection URL)
src/proxy.ts                    # Clerk middleware
src/lib/
  db.ts                         # Prisma client; money stored as integer cents, exposed as `amount`
  auth.ts / api.ts              # session lookup + withUser() wrapper for API routes
  seed.ts                       # per-user setup, default categories, demo data
  recurring.ts                  # recurring-expense scheduling (materialized on load)
  receipts.ts                   # private Blob storage for receipt images
  csv.ts                        # CSV / date / money parsing for imports
  categories.ts / period.ts / budget-status.ts / pdf-report.ts / format.ts / types.ts
src/app/api/
  expenses/ (+ [id], [id]/receipt)  categories/ (+ [id])  income/ (+ [id])
  recurring/ (+ [id])  import/  settings/  analytics/  scan/  demo/
  reports/pdf | reports/csv | reports/monthly
src/components/expense-tracker/ # app views and dialogs
```

## Notes

- Money is stored as integer cents to avoid floating-point rounding; the currency setting changes display only (no conversion).
- Dates are plain `YYYY-MM-DD` strings in the user's local calendar; period math is timezone-safe string math.

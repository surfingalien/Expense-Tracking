# AI Expense Tracker

A modern expense-tracking web app with AI receipt scanning, automatic per-item categorization, budgets, an analytics dashboard, and PDF/CSV report export. Single-user, no login required.

![stack](https://img.shields.io/badge/Next.js%2016-React%2019-10b981) ![db](https://img.shields.io/badge/Prisma-SQLite-2D3748) ![style](https://img.shields.io/badge/Tailwind%204-shadcn%2Fui-emerald)

## Features

- **AI receipt scanning** — upload or drag a receipt photo; GLM-4.6V (via `z-ai-web-dev-sdk`) extracts the merchant, date, line items, tax and total. You review the extracted data in a confirmation form before anything is saved.
- **Automatic categorization** — keyword rules + AI suggestions assign each expense to one of 10 default categories (Food & Dining, Groceries, Shopping, Transportation, …). The scan form also captures individual line items.
- **Dashboard** — KPI stat cards, daily/monthly spending trend chart, category donut chart, budget progress bars, top-merchants ranking, recent transactions. Period switcher: Today / Week / Month / 30D / Year with previous-period comparison.
- **Budgets** — set a monthly budget per category with inline editing, progress bars, "Over" badges and toast warnings at ≥80% and >100% usage.
- **Reports** — multi-page vector PDF report (KPIs, category breakdown, budget performance, trend chart, monthly summary, transaction list) and CSV export.
- **Demo data** — 90 days of realistic seeded transactions (subscriptions, random daily spending, monthly trips) so every view is populated on first launch.

## Tech stack

| Layer     | Choice                                                      |
| --------- | ----------------------------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript                        |
| UI        | Tailwind CSS 4 + shadcn/ui + Recharts + lucide-react + sonner |
| Data      | TanStack Query (client) + Prisma 6 / SQLite (server)        |
| Reports   | pdf-lib (vector PDF) + native CSV                            |
| Images    | sharp (client-size compression before OCR)                   |
| AI        | z-ai-web-dev-sdk → GLM-4.6V vision model                     |

## Getting started

### 1. Install dependencies

```bash
bun install        # or: npm install
```

### 2. Configure the database

Create a `.env` file in the project root (one is included; adjust if you move things around):

```
DATABASE_URL=file:../db/custom.db
```

> Prisma resolves this path relative to `prisma/schema.prisma`, so it points at `<project>/db/custom.db`.

Create the schema (a pre-seeded `db/custom.db` ships with the zip, so this step is optional if you kept it):

```bash
bun run db:generate   # prisma generate
bun run db:push       # prisma db push --accept-data-loss
```

### 3. Run the app

```bash
bun run dev           # or: npm run dev  → http://localhost:3000
```

On first request the app seeds the 10 default categories and 90 days of demo expenses automatically. To clear or reload demo data use the **Demo data** control in the app (POST `/api/demo` with `{"action":"load"|"clear"}`).

### 4. Enable AI receipt scanning (optional)

Receipt scanning calls the `z-ai-web-dev-sdk` (GLM-4.6V). Credentials are read from the SDK's standard configuration. Without valid credentials everything else still works — manual entry, budgets, analytics and reports — and the scan dialog will show an error toast.

### 5. Build for production

```bash
bun run build && bun run start
```

## Project structure

```
prisma/schema.prisma            # Category + Expense models
db/custom.db                    # SQLite database (pre-seeded demo data)
src/lib/
  db.ts                         # Prisma client singleton
  seed.ts                       # deterministic 90-day demo data + ensureSeed()
  categories.ts                 # default categories, keyword → category rules
  period.ts                     # timezone-safe date math, trend bucketing
  budget-status.ts              # monthly budget computation
  pdf-report.ts                 # pdf-lib multi-page report renderer
  types.ts / format.ts / utils.ts
src/app/api/
  expenses/ (+ [id])            # CRUD, returns budget status after mutations
  categories/ (+ [id])          # CRUD incl. budget
  analytics/                    # trend, category %, merchants, budgets, monthly
  scan/                         # sharp → GLM-4.6V → validated JSON
  reports/pdf | reports/csv | reports/monthly
  demo/                         # load / clear demo dataset
src/components/expense-tracker/ # all app views (dashboard, expenses, budgets, reports, scan)
src/components/ui/              # shadcn/ui primitives
scripts/make_receipt.py         # generates a test receipt image for trying the scanner
```

## Notes

- Amounts are USD. Dates are stored as plain `YYYY-MM-DD` strings in the user's local calendar; all period math is UTC-based string math, so it is timezone-safe.
- Receipt images are compressed client-side before upload and stored as data URLs on the expense record.
- `next dev` does not type-check; use `bunx tsc --noEmit` and `bun run lint` before shipping changes.

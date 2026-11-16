// Seeds default categories on first run and generates a realistic demo
// expense dataset (~90 days) so the dashboard is alive out of the box.

import { db, toCents } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { toISODate } from '@/lib/period'
import { materializeRecurring } from '@/lib/recurring'

// Deterministic PRNG so demo data is stable between runs.
function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260314)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function amountBetween(min: number, max: number): number {
  const raw = min + rand() * (max - min)
  // make prices look natural (e.g. 12.49, 23.80)
  return Math.round(raw * 100) / 100
}

interface MerchantSpec {
  name: string
  min: number
  max: number
  desc?: string
}

const RANDOM_MERCHANTS: Record<string, MerchantSpec[]> = {
  'Food & Dining': [
    { name: 'Starbucks', min: 6, max: 14, desc: 'Morning coffee' },
    { name: 'Chipotle', min: 11, max: 19, desc: 'Lunch' },
    { name: "McDonald's", min: 8, max: 17, desc: 'Lunch' },
    { name: 'Panera Bread', min: 12, max: 23, desc: 'Lunch' },
    { name: "Domino's Pizza", min: 18, max: 36, desc: 'Dinner' },
    { name: "Dunkin'", min: 5, max: 12, desc: 'Coffee run' },
    { name: 'Sunset Diner', min: 15, max: 33, desc: 'Dinner' },
    { name: 'Sushi Ten', min: 22, max: 48, desc: 'Dinner' },
  ],
  Groceries: [
    { name: "Trader Joe's", min: 28, max: 68 },
    { name: 'Whole Foods Market', min: 45, max: 125 },
    { name: 'Kroger', min: 35, max: 98 },
    { name: 'Costco Wholesale', min: 85, max: 185 },
    { name: 'Walmart Supercenter', min: 32, max: 112 },
  ],
  Shopping: [
    { name: 'Amazon', min: 15, max: 92 },
    { name: 'Target', min: 22, max: 115 },
    { name: 'Best Buy', min: 45, max: 220 },
    { name: 'H&M', min: 25, max: 78 },
    { name: 'IKEA', min: 40, max: 185 },
  ],
  Transportation: [
    { name: 'Uber', min: 9, max: 29, desc: 'Ride' },
    { name: 'Shell Gas Station', min: 34, max: 58, desc: 'Fuel' },
    { name: 'Lyft', min: 10, max: 27, desc: 'Ride' },
    { name: 'City Parking Garage', min: 5, max: 18 },
    { name: 'Metro Transit', min: 3, max: 8 },
  ],
  Entertainment: [
    { name: 'AMC Theatres', min: 16, max: 39, desc: 'Movie night' },
    { name: 'Steam', min: 12, max: 46, desc: 'Games' },
    { name: 'Concert Ticket', min: 35, max: 95, desc: 'Live show' },
    { name: 'Bowling Alley', min: 18, max: 42 },
  ],
  Health: [
    { name: 'CVS Pharmacy', min: 12, max: 46 },
    { name: 'Walgreens', min: 10, max: 39 },
    { name: 'Fitness Club', min: 29, max: 49, desc: 'Membership' },
    { name: 'Bright Dental Clinic', min: 60, max: 155 },
  ],
  Travel: [
    { name: 'Delta Air Lines', min: 180, max: 430 },
    { name: 'Marriott Hotel', min: 140, max: 330 },
    { name: 'Airbnb', min: 120, max: 385 },
  ],
  Education: [
    { name: 'Udemy', min: 12, max: 36, desc: 'Online course' },
    { name: 'Coursera', min: 39, max: 59 },
    { name: 'Barnes & Noble', min: 15, max: 42, desc: 'Books' },
  ],
  Other: [
    { name: 'Corner Gift Shop', min: 12, max: 36 },
    { name: 'Office Supplies Co.', min: 8, max: 32 },
    { name: 'Pet Supply Plus', min: 15, max: 45 },
  ],
}

// Weekly spend probability per category (1.0 = about once every day is too high; per-day chance)
const DAILY_PROBABILITY: Record<string, number> = {
  'Food & Dining': 0.62,
  Groceries: 0.24,
  Shopping: 0.13,
  Transportation: 0.38,
  Entertainment: 0.16,
  Health: 0.10,
  Travel: 0.03,
  Education: 0.03,
  Other: 0.09,
}

interface SubscriptionSpec {
  dayOfMonth: number
  merchant: string
  amount: number
  category: string
  desc: string
}

const SUBSCRIPTIONS: SubscriptionSpec[] = [
  { dayOfMonth: 3, merchant: 'Netflix', amount: 15.49, category: 'Entertainment', desc: 'Monthly subscription' },
  { dayOfMonth: 8, merchant: 'Spotify', amount: 10.99, category: 'Entertainment', desc: 'Monthly subscription' },
  { dayOfMonth: 12, merchant: 'Mobile Plan — Verizon', amount: 68.5, category: 'Bills & Utilities', desc: 'Monthly phone plan' },
  { dayOfMonth: 5, merchant: 'Electric Bill', amount: 0, category: 'Bills & Utilities', desc: 'Monthly utility' },
  { dayOfMonth: 10, merchant: 'Internet — Comcast', amount: 79.99, category: 'Bills & Utilities', desc: 'Monthly broadband' },
  { dayOfMonth: 16, merchant: 'Water Utility', amount: 0, category: 'Bills & Utilities', desc: 'Monthly utility' },
]

/** Prisma client or an interactive-transaction client. */
type DbClient = Pick<typeof db, 'category' | 'expense' | 'userSettings'>

export async function seedDemoExpenses(userId: string, todayISO?: string, client: DbClient = db): Promise<number> {
  const todayStr = todayISO || toISODate(new Date())
  const categories = await client.category.findMany({ where: { userId } })
  if (categories.length === 0) return 0
  const byName = new Map(categories.map((c) => [c.name, c.id]))

  const days = 90
  const rows: {
    userId: string
    amountCents: number
    merchant: string
    date: string
    description: string | null
    categoryId: string
    source: string
    isDemo: boolean
  }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${todayStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    const dateISO = d.toISOString().slice(0, 10)
    const dayOfMonth = d.getUTCDate()

    // Fixed monthly subscriptions & utilities
    for (const sub of SUBSCRIPTIONS) {
      if (sub.dayOfMonth !== dayOfMonth) continue
      const amt = sub.merchant.includes('Electric')
        ? amountBetween(68, 132)
        : sub.merchant.includes('Water')
          ? amountBetween(27, 46)
          : sub.amount
      const categoryId = byName.get(sub.category)
      if (!categoryId) continue
      rows.push({
        userId,
        amountCents: toCents(amt),
        merchant: sub.merchant,
        date: dateISO,
        description: sub.desc,
        categoryId,
        source: 'demo',
        isDemo: true,
      })
    }

    // Random day-to-day spending
    for (const [categoryName, prob] of Object.entries(DAILY_PROBABILITY)) {
      if (rand() > prob) continue
      const spec = pick(RANDOM_MERCHANTS[categoryName] || [])
      const categoryId = byName.get(categoryName)
      if (!spec || !categoryId) continue
      // occasionally two purchases in a day for food
      const reps = categoryName === 'Food & Dining' && rand() < 0.28 ? 2 : 1
      for (let r = 0; r < reps; r++) {
        rows.push({
          userId,
          amountCents: toCents(amountBetween(spec.min, spec.max)),
          merchant: spec.name,
          date: dateISO,
          description: spec.desc ?? null,
          categoryId,
          source: 'demo',
          isDemo: true,
        })
      }
    }

  }

  // Travel tends to come in a single burst each month (a trip)
  for (let back = 3; back >= 0; back--) {
    const d = new Date(`${todayStr}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - back)
    d.setUTCDate(Math.min(2 + Math.floor(rand() * 3), 20))
    const dateISO = d.toISOString().slice(0, 10)
    if (dateISO > todayStr) continue
    const categoryId = byName.get('Travel')
    const spec = pick(RANDOM_MERCHANTS['Travel'])
    if (!categoryId || !spec) continue
    rows.push({
      userId,
      amountCents: toCents(amountBetween(spec.min, spec.max)),
      merchant: spec.name,
      date: dateISO,
      description: 'Trip',
      categoryId,
      source: 'demo',
      isDemo: true,
    })
  }

  if (rows.length === 0) return 0
  const result = await client.expense.createMany({ data: rows })
  return result.count
}

const setupPromises = new Map<string, Promise<void>>()

// Arbitrary constant key for the Postgres advisory lock that serializes
// first-time user setup across concurrent requests / function instances.
const SETUP_LOCK_KEY = 74_210_301

async function setupUser(userId: string, todayISO: string): Promise<void> {
  // Fast path: already set up (no lock needed).
  if (await db.userSettings.findUnique({ where: { userId } })) return

  // A freshly signed-in page fires several API calls at once, often on
  // different function instances. Take a transaction-scoped advisory lock so
  // exactly one of them performs setup; the others wait, then see it done.
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`
      if (await tx.userSettings.findUnique({ where: { userId } })) return

      // The very first user to sign in inherits data created before sign-in
      // existed (rows with no owner), so nothing already stored is lost.
      const anyUser = await tx.userSettings.count()
      await tx.userSettings.create({ data: { userId } })
      if (anyUser === 0) {
        await tx.category.updateMany({ where: { userId: null }, data: { userId } })
        await tx.expense.updateMany({ where: { userId: null }, data: { userId } })
      }

      const catCount = await tx.category.count({ where: { userId } })
      if (catCount === 0) {
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((c) => ({
            userId,
            name: c.name,
            icon: c.icon,
            color: c.color,
            budgetCents: c.budget == null ? null : toCents(c.budget),
            isDefault: true,
          })),
        })
        // Demo expenses are seeded only on first-time setup, so clearing them
        // sticks (instead of re-seeding whenever the expense table is empty).
        await seedDemoExpenses(userId, todayISO, tx)
      }
    },
    { timeout: 30_000, maxWait: 30_000 },
  )
}

/**
 * Idempotent per-user bootstrap: creates settings, default categories and
 * demo data the first time a user is seen, then materializes any recurring
 * expenses that have come due.
 */
export async function ensureUserSetup(userId: string, todayISO?: string): Promise<void> {
  const today = todayISO && /^\d{4}-\d{2}-\d{2}$/.test(todayISO) ? todayISO : toISODate(new Date())
  let p = setupPromises.get(userId)
  if (!p) {
    p = setupUser(userId, today).catch((err) => {
      setupPromises.delete(userId)
      throw err
    })
    setupPromises.set(userId, p)
  }
  await p
  await materializeRecurring(userId, today)
}

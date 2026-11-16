import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/** Converts a major-unit amount (e.g. 12.34) to integer cents (1234). */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Converts integer cents back to a major-unit amount. */
export function fromCents(cents: number): number {
  return cents / 100
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  // Money is stored as integer cents. These computed fields let the rest of
  // the app keep reading `amount` / `budget` in major units (dollars).
  return base.$extends({
    result: {
      expense: {
        amount: { needs: { amountCents: true }, compute: (e) => fromCents(e.amountCents) },
      },
      income: {
        amount: { needs: { amountCents: true }, compute: (i) => fromCents(i.amountCents) },
      },
      recurringExpense: {
        amount: { needs: { amountCents: true }, compute: (r) => fromCents(r.amountCents) },
      },
      category: {
        budget: {
          needs: { budgetCents: true },
          compute: (c) => (c.budgetCents == null ? null : fromCents(c.budgetCents)),
        },
      },
    },
  })
}

type DB = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as { prisma: DB | undefined }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

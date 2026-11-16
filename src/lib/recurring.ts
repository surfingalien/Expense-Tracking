// Recurring expenses are materialized lazily: whenever a user's data is
// loaded, every active rule whose nextDate is due gets its missing
// occurrences created as normal expenses. No cron job is needed.
import { db } from '@/lib/db'

export type Frequency = 'weekly' | 'monthly' | 'yearly'
export const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'yearly']

const MAX_OCCURRENCES_PER_RUN = 120

/** Returns the occurrence after `iso`, anchored to the rule's start day. */
export function nextOccurrence(iso: string, frequency: Frequency, startDate: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (frequency === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + 7))
    return dt.toISOString().slice(0, 10)
  }
  // Monthly/yearly keep the original day of month, clamped to month length
  // (e.g. a rule starting Jan 31 falls on Feb 28, then Mar 31).
  const anchorDay = Number(startDate.slice(8, 10))
  const monthsToAdd = frequency === 'monthly' ? 1 : 12
  const target = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1))
  const ty = target.getUTCFullYear()
  const tm = target.getUTCMonth()
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const day = Math.min(anchorDay, lastDay)
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Creates any due occurrences for the user's active recurring rules. */
export async function materializeRecurring(userId: string, todayISO: string): Promise<number> {
  const due = await db.recurringExpense.findMany({
    where: { userId, active: true, nextDate: { lte: todayISO } },
  })
  let created = 0
  for (const rule of due) {
    const dates: string[] = []
    let cursor = rule.nextDate
    while (cursor <= todayISO && dates.length < MAX_OCCURRENCES_PER_RUN) {
      dates.push(cursor)
      cursor = nextOccurrence(cursor, rule.frequency as Frequency, rule.startDate)
    }
    if (dates.length === 0) continue
    // Only advance if nobody else advanced it first (concurrent requests).
    const claimed = await db.recurringExpense.updateMany({
      where: { id: rule.id, nextDate: rule.nextDate },
      data: { nextDate: cursor },
    })
    if (claimed.count === 0) continue
    const result = await db.expense.createMany({
      data: dates.map((date) => ({
        userId,
        amountCents: rule.amountCents,
        merchant: rule.merchant,
        description: rule.description,
        categoryId: rule.categoryId,
        date,
        source: 'recurring',
        recurringId: rule.id,
      })),
    })
    created += result.count
  }
  return created
}

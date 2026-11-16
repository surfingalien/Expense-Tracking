// Computes the monthly budget usage for a category (server-side helper).
import { db, fromCents } from '@/lib/db'
import { currentMonthKey } from '@/lib/period'

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` }
}

export async function budgetStatusFor(userId: string, categoryId: string, date: string) {
  const category = await db.category.findFirst({ where: { id: categoryId, userId } })
  if (!category || category.budget == null) return null
  const { start, end } = monthBounds(currentMonthKey(date))
  const agg = await db.expense.aggregate({
    _sum: { amountCents: true },
    where: { userId, categoryId, date: { gte: start, lte: end } },
  })
  return {
    categoryId,
    categoryName: category.name,
    budget: category.budget,
    monthTotal: fromCents(agg._sum.amountCents || 0),
  }
}

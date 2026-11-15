// Computes the monthly budget usage for a category (server-side helper).
import { db } from '@/lib/db'
import { currentMonthKey } from '@/lib/period'

export async function budgetStatusFor(categoryId: string, date: string) {
  const category = await db.category.findUnique({ where: { id: categoryId } })
  if (!category || category.budget == null) return null
  const month = currentMonthKey(date)
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`
  const agg = await db.expense.aggregate({
    _sum: { amount: true },
    where: { categoryId, date: { gte: start, lte: end } },
  })
  return {
    categoryId,
    categoryName: category.name,
    budget: category.budget,
    monthTotal: Math.round((agg._sum.amount || 0) * 100) / 100,
  }
}

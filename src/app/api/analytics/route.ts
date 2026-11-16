import { NextResponse } from 'next/server'
import { db, fromCents } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { monthBounds } from '@/lib/budget-status'
import { toExpenseDTO } from '@/lib/dto'
import { bucketKeyOf, currentMonthKey, daysBetween, listBuckets, shortDayLabel } from '@/lib/period'
import type { AnalyticsResponse, CategorySlice, MerchantStat, TrendBucket } from '@/lib/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY = /^\d{4}-\d{2}$/

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// All sums are done in integer cents and converted once at the end.
export const GET = withUser('GET /api/analytics', async (req, _ctx, { userId }) => {
    const sp = req.nextUrl.searchParams

    const start = sp.get('start') || ''
    const end = sp.get('end') || ''
    const prevStart = sp.get('prevStart') || ''
    const prevEnd = sp.get('prevEnd') || ''
    const granularity = sp.get('granularity') === 'month' ? 'month' : 'day'
    const monthParam = sp.get('month')
    const month = monthParam && MONTH_KEY.test(monthParam) ? monthParam : null
    const monthlyCount = Math.min(Math.max(Number(sp.get('monthly')) || 0, 0), 24)

    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return jsonError('start and end (YYYY-MM-DD) are required')
    }

    const [expenses, categories, incomeAgg] = await Promise.all([
      db.expense.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: { amountCents: true, categoryId: true, merchant: true, date: true },
      }),
      db.category.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
      db.income.aggregate({ where: { userId, date: { gte: start, lte: end } }, _sum: { amountCents: true } }),
    ])

    // ---- summary ----
    const totalCents = expenses.reduce((s, e) => s + e.amountCents, 0)
    const total = fromCents(totalCents)
    const income = fromCents(incomeAgg._sum.amountCents || 0)
    const days = daysBetween(start, end)
    let prevTotal = 0
    if (ISO_DATE.test(prevStart) && ISO_DATE.test(prevEnd)) {
      const prevAgg = await db.expense.aggregate({
        _sum: { amountCents: true },
        where: { userId, date: { gte: prevStart, lte: prevEnd } },
      })
      prevTotal = fromCents(prevAgg._sum.amountCents || 0)
    }
    const deltaPct = prevTotal > 0 ? round2(((total - prevTotal) / prevTotal) * 100) : null

    // ---- trend ----
    const buckets: TrendBucket[] = listBuckets(start, end, granularity)
    const byBucket = new Map<string, number>()
    for (const b of buckets) byBucket.set(b.key, 0)
    for (const e of expenses) {
      const key = bucketKeyOf(e.date, granularity)
      if (byBucket.has(key)) byBucket.set(key, (byBucket.get(key) || 0) + e.amountCents)
    }
    for (const b of buckets) b.amount = fromCents(byBucket.get(b.key) || 0)
    // dense daily series read better with date labels than repeated weekdays
    if (granularity === 'day' && buckets.length > 10) {
      for (const b of buckets) b.label = shortDayLabel(b.key)
    }

    // ---- category breakdown ----
    const catAgg = new Map<string, { total: number; count: number }>()
    for (const e of expenses) {
      const cur = catAgg.get(e.categoryId) || { total: 0, count: 0 }
      cur.total += e.amountCents
      cur.count += 1
      catAgg.set(e.categoryId, cur)
    }
    const categories_out: CategorySlice[] = [...catAgg.entries()]
      .map(([id, agg]) => {
        const c = categories.find((x) => x.id === id)
        return {
          id,
          name: c?.name || 'Unknown',
          color: c?.color || '#94a3b8',
          total: fromCents(agg.total),
          count: agg.count,
          pct: totalCents > 0 ? round2((agg.total / totalCents) * 100) : 0,
        }
      })
      .sort((a, b) => b.total - a.total)
    const topCat = categories_out[0] || null

    // ---- top merchants ----
    const merchAgg = new Map<string, { total: number; count: number; display: string }>()
    for (const e of expenses) {
      const key = e.merchant.trim().toLowerCase()
      const cur = merchAgg.get(key) || { total: 0, count: 0, display: e.merchant.trim() }
      cur.total += e.amountCents
      cur.count += 1
      merchAgg.set(key, cur)
    }
    const merchants: MerchantStat[] = [...merchAgg.entries()]
      .map(([, v]) => ({ name: v.display, total: fromCents(v.total), count: v.count, pct: totalCents > 0 ? round2((v.total / totalCents) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    // ---- budgets (for the requested month) ----
    const budgetMonth = month || currentMonthKey(end)
    const { start: bStart, end: bEnd } = monthBounds(budgetMonth)
    const budgeted = categories.filter((c) => c.budget != null && c.budget > 0)
    const monthAgg = budgeted.length
      ? await db.expense.groupBy({
          by: ['categoryId'],
          where: { userId, date: { gte: bStart, lte: bEnd }, categoryId: { in: budgeted.map((c) => c.id) } },
          _sum: { amountCents: true },
        })
      : []
    const monthMap = new Map(monthAgg.map((m) => [m.categoryId, fromCents(m._sum.amountCents || 0)]))
    const budgets = budgeted
      .map((c) => {
        const spent = monthMap.get(c.id) || 0
        const pct = Math.round((spent / (c.budget || 1)) * 100)
        return {
          categoryId: c.id,
          name: c.name,
          color: c.color,
          icon: c.icon,
          budget: c.budget || 0,
          spent,
          pct,
          over: spent > (c.budget || 0),
        }
      })
      .sort((a, b) => b.pct - a.pct)

    // ---- recent ----
    const recentRows = await db.expense.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    })
    const recent = recentRows.map(toExpenseDTO)

    // ---- monthly summary (optional) ----
    let monthly: AnalyticsResponse['monthly'] | undefined
    if (monthlyCount > 0) {
      const [ey, em] = end.split('-').map(Number)
      const anchor = new Date(Date.UTC(ey, em - 1, 1))
      anchor.setUTCMonth(anchor.getUTCMonth() - (monthlyCount - 1))
      const firstKey = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, '0')}`
      const startOfMonthStr = `${firstKey}-01`
      const rows = await db.expense.groupBy({
        by: ['date'],
        where: { userId, date: { gte: startOfMonthStr, lte: end } },
        _sum: { amountCents: true },
        _count: { _all: true },
      })
      const monthTotals = new Map<string, { total: number; count: number }>()
      for (const r of rows) {
        const key = r.date.slice(0, 7)
        const cur = monthTotals.get(key) || { total: 0, count: 0 }
        cur.total += r._sum.amountCents || 0
        cur.count += r._count._all
        monthTotals.set(key, cur)
      }
      monthly = []
      let cursorKey = firstKey
      for (let i = 0; i < monthlyCount; i++) {
        const cur = monthTotals.get(cursorKey)
        monthly.push({ month: cursorKey, total: fromCents(cur?.total || 0), count: cur?.count || 0 })
        const [cy, cm] = cursorKey.split('-').map(Number)
        const nm = cm === 12 ? 1 : cm + 1
        const ny = cm === 12 ? cy + 1 : cy
        cursorKey = `${ny}-${String(nm).padStart(2, '0')}`
      }
    }

    const response: AnalyticsResponse = {
      summary: {
        total,
        count: expenses.length,
        avgPerDay: round2(total / days),
        days,
        prevTotal,
        deltaPct,
        income,
        net: round2(income - total),
        topCategory: topCat ? { name: topCat.name, color: topCat.color, total: topCat.total } : null,
      },
      trend: buckets,
      categories: categories_out,
      merchants,
      budgets,
      recent,
      monthly,
    }
    return NextResponse.json(response)
})

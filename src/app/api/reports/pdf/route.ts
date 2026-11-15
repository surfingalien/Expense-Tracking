import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { buildExpenseReportPDF, type ReportData } from '@/lib/pdf-report'
import { currentMonthKey, daysBetween, listBuckets, bucketKeyOf, shortDayLabel } from '@/lib/period'
import type { BudgetProgress, CategorySlice, MonthlyRow, TrendBucket } from '@/lib/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY = /^\d{4}-\d{2}$/

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const start = sp.get('start') || ''
    const end = sp.get('end') || ''
    const periodLabel = (sp.get('label') || 'Custom period').slice(0, 80)
    const monthParam = sp.get('month')

    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return NextResponse.json({ error: 'start and end (YYYY-MM-DD) are required' }, { status: 400 })
    }

    const [expenses, categories] = await Promise.all([
      db.expense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      db.category.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    ])

    const total = round2(expenses.reduce((s, e) => s + e.amount, 0))
    const days = daysBetween(start, end)

    const catAgg = new Map<string, { total: number; count: number }>()
    for (const e of expenses) {
      const cur = catAgg.get(e.categoryId) || { total: 0, count: 0 }
      cur.total += e.amount
      cur.count += 1
      catAgg.set(e.categoryId, cur)
    }
    const categorySlices: CategorySlice[] = [...catAgg.entries()]
      .map(([id, agg]) => {
        const c = categories.find((x) => x.id === id)
        return {
          id,
          name: c?.name || 'Unknown',
          color: c?.color || '#94a3b8',
          total: round2(agg.total),
          count: agg.count,
          pct: total > 0 ? round2((agg.total / total) * 100) : 0,
        }
      })
      .sort((a, b) => b.total - a.total)

    // Trend: daily buckets for periods up to ~62 days, monthly beyond that.
    const granularity = daysBetween(start, end) > 62 ? 'month' : 'day'
    const buckets: TrendBucket[] = listBuckets(start, end, granularity)
    const byBucket = new Map<string, number>()
    for (const b of buckets) byBucket.set(b.key, 0)
    for (const e of expenses) {
      const key = bucketKeyOf(e.date, granularity)
      if (byBucket.has(key)) byBucket.set(key, (byBucket.get(key) || 0) + e.amount)
    }
    for (const b of buckets) b.amount = round2(byBucket.get(b.key) || 0)
    if (granularity === 'day' && buckets.length > 10) {
      for (const b of buckets) b.label = shortDayLabel(b.key)
    }

    // Budget performance for the month covering the report (or requested month)
    const budgetMonth = monthParam && MONTH_KEY.test(monthParam) ? monthParam : currentMonthKey(end)
    const budgeted = categories.filter((c) => c.budget != null && c.budget > 0)
    const monthAgg = budgeted.length
      ? await db.expense.groupBy({
          by: ['categoryId'],
          where: { date: { gte: `${budgetMonth}-01`, lte: `${budgetMonth}-31` }, categoryId: { in: budgeted.map((c) => c.id) } },
          _sum: { amount: true },
        })
      : []
    const monthMap = new Map(monthAgg.map((m) => [m.categoryId, m._sum.amount || 0]))
    const budgets: BudgetProgress[] = budgeted
      .map((c) => {
        const spent = round2(monthMap.get(c.id) || 0)
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

    // Monthly summary across the trailing 6 months up to `end`
    const monthly: MonthlyRow[] = []
    const [ey, em] = end.split('-').map(Number)
    const anchor = new Date(Date.UTC(ey, em - 1, 1))
    anchor.setUTCMonth(anchor.getUTCMonth() - 5)
    const firstKey = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, '0')}`
    const dateRows = await db.expense.groupBy({
      by: ['date'],
      where: { date: { gte: `${firstKey}-01`, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    })
    const monthTotals = new Map<string, { total: number; count: number }>()
    for (const r of dateRows) {
      const key = r.date.slice(0, 7)
      const cur = monthTotals.get(key) || { total: 0, count: 0 }
      cur.total += r._sum.amount || 0
      cur.count += r._count._all
      monthTotals.set(key, cur)
    }
    let cursorKey = firstKey
    for (let i = 0; i < 6; i++) {
      const cur = monthTotals.get(cursorKey)
      monthly.push({ month: cursorKey, total: round2(cur?.total || 0), count: cur?.count || 0 })
      const [cy, cm] = cursorKey.split('-').map(Number)
      const nm = cm === 12 ? 1 : cm + 1
      const ny = cm === 12 ? cy + 1 : cy
      cursorKey = `${ny}-${String(nm).padStart(2, '0')}`
    }

    const data: ReportData = {
      periodLabel,
      start,
      end,
      total,
      count: expenses.length,
      avgPerDay: round2(total / days),
      topCategory: categorySlices[0]?.name || '-',
      categories: categorySlices,
      budgets,
      trend: buckets,
      expenses: expenses.map((e) => ({
        date: e.date,
        merchant: e.merchant,
        category: e.category.name,
        description: e.description,
        amount: e.amount,
      })),
      monthly,
    }

    const bytes = await buildExpenseReportPDF(data)
    const filename = `expense-report-${start}-to-${end}.pdf`
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/reports/pdf failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 })
  }
}

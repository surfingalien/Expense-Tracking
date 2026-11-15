import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import type { MonthSummary } from '@/lib/types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const today = sp.get('today') || undefined
    await ensureSeed(today)
    const months = Math.min(Math.max(Number(sp.get('months')) || 6, 1), 24)
    const endParam = sp.get('end')
    const endISO = endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam) ? endParam : undefined

    // Determine the last month key: from endISO or current UTC month
    const now = endISO ? new Date(`${endISO}T00:00:00Z`) : new Date()
    const lastYear = now.getUTCFullYear()
    const lastMonth = now.getUTCMonth() + 1

    const keys: string[] = []
    let y = lastYear
    let m = lastMonth
    for (let i = 0; i < months; i++) {
      keys.unshift(`${y}-${String(m).padStart(2, '0')}`)
      m -= 1
      if (m === 0) { m = 12; y -= 1 }
    }

    const firstKey = keys[0]
    const endKey = keys[keys.length - 1]
    const [ey, em] = endKey.split('-').map(Number)
    const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate()
    const endDate = `${endKey}-${String(lastDay).padStart(2, '0')}`

    const rows = await db.expense.groupBy({
      by: ['date'],
      where: { date: { gte: `${firstKey}-01`, lte: endDate } },
      _sum: { amount: true },
      _count: { _all: true },
    })
    const totals = new Map<string, { total: number; count: number }>()
    for (const r of rows) {
      const key = r.date.slice(0, 7)
      const cur = totals.get(key) || { total: 0, count: 0 }
      cur.total += r._sum.amount || 0
      cur.count += r._count._all
      totals.set(key, cur)
    }

    const out: MonthSummary[] = []
    let prevTotal = 0
    for (const key of keys) {
      const cur = totals.get(key)
      const total = round2(cur?.total || 0)
      out.push({
        month: key,
        total,
        count: cur?.count || 0,
        deltaPct: prevTotal > 0 ? round2(((total - prevTotal) / prevTotal) * 100) : null,
      })
      prevTotal = total
    }
    return NextResponse.json({ months: out })
  } catch (err) {
    console.error('GET /api/reports/monthly failed:', err)
    return NextResponse.json({ error: 'Failed to load monthly summary' }, { status: 500 })
  }
}

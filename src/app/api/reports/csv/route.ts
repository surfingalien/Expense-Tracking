import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function money(n: number): string {
  return n.toFixed(2)
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const start = sp.get('start') || ''
    const end = sp.get('end') || ''
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return NextResponse.json({ error: 'start and end (YYYY-MM-DD) are required' }, { status: 400 })
    }

    const expenses = await db.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    const lines: string[] = [
      'Date,Merchant,Category,Description,Amount,Source',
      ...expenses.map((e) =>
        [
          e.date,
          e.merchant,
          e.category.name,
          e.description || '',
          money(e.amount),
          e.source === 'scan' ? 'Scanned receipt' : e.source === 'demo' ? 'Demo' : 'Manual entry',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ]

    const total = expenses.reduce((s, e) => s + e.amount, 0)
    lines.push('')
    lines.push(`,,,,${money(total)},TOTAL`)

    const csv = `\uFEFF${lines.join('\n')}`
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="expenses-${start}-to-${end}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/reports/csv failed:', err)
    return NextResponse.json({ error: 'Failed to generate CSV report' }, { status: 500 })
  }
}

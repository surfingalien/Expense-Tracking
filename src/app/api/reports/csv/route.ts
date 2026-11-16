import { db, fromCents } from '@/lib/db'
import { ISO_DATE, jsonError, withUser } from '@/lib/api'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function money(n: number): string {
  return n.toFixed(2)
}

const SOURCE_LABEL: Record<string, string> = {
  scan: 'Scanned receipt',
  demo: 'Demo',
  recurring: 'Recurring',
  import: 'Imported',
}

export const GET = withUser('GET /api/reports/csv', async (req, _ctx, { userId }) => {
    const sp = req.nextUrl.searchParams
    const start = sp.get('start') || ''
    const end = sp.get('end') || ''
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return jsonError('start and end (YYYY-MM-DD) are required')
    }

    const expenses = await db.expense.findMany({
      where: { userId, date: { gte: start, lte: end } },
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
          SOURCE_LABEL[e.source] || 'Manual entry',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ]

    const total = fromCents(expenses.reduce((s, e) => s + e.amountCents, 0))
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
})

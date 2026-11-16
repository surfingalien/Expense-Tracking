import { NextResponse } from 'next/server'
import { db, fromCents } from '@/lib/db'
import { ISO_DATE, jsonError, parseAmountCents, withUser } from '@/lib/api'
import type { IncomeDTO } from '@/lib/types'

function toIncomeDTO(i: {
  id: string
  amount: number
  source: string
  date: string
  description: string | null
  createdAt: Date
}): IncomeDTO {
  return { id: i.id, amount: i.amount, source: i.source, date: i.date, description: i.description, createdAt: i.createdAt.toISOString() }
}

export const GET = withUser('GET /api/income', async (req, _ctx, { userId }) => {
  const sp = req.nextUrl.searchParams
  const start = sp.get('start') || ''
  const end = sp.get('end') || ''
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return jsonError('start and end (YYYY-MM-DD) are required')
  const where = { userId, date: { gte: start, lte: end } }
  const [rows, agg] = await Promise.all([
    db.income.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 500 }),
    db.income.aggregate({ where, _sum: { amountCents: true } }),
  ])
  return NextResponse.json({ income: rows.map(toIncomeDTO), total: fromCents(agg._sum.amountCents || 0) })
})

export const POST = withUser('POST /api/income', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as Record<string, unknown>
  const amountCents = parseAmountCents(body.amount)
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 80) : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : null
  if (amountCents == null) return jsonError('Amount must be a positive number')
  if (!source) return jsonError('Source is required')
  if (!ISO_DATE.test(date)) return jsonError('Date must be in YYYY-MM-DD format')
  const income = await db.income.create({ data: { userId, amountCents, source, date, description } })
  return NextResponse.json({ income: toIncomeDTO(income) }, { status: 201 })
})

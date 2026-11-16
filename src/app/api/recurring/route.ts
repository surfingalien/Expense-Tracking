import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { materializeRecurring } from '@/lib/recurring'
import { toRecurringDTO, validateRecurring } from '@/lib/recurring-input'
import { toISODate } from '@/lib/period'

export const GET = withUser('GET /api/recurring', async (_req, _ctx, { userId }) => {
  const rows = await db.recurringExpense.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ active: 'desc' }, { nextDate: 'asc' }],
  })
  return NextResponse.json({ recurring: rows.map(toRecurringDTO) })
})

export const POST = withUser('POST /api/recurring', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as Record<string, unknown>
  const v = await validateRecurring(userId, body)
  if ('error' in v) return jsonError(v.error)
  const rule = await db.recurringExpense.create({
    data: {
      userId,
      amountCents: v.amountCents,
      merchant: v.merchant,
      description: v.description,
      categoryId: v.categoryId,
      frequency: v.frequency,
      startDate: v.startDate,
      nextDate: v.startDate,
    },
    include: { category: true },
  })
  // Back-fill occurrences if the start date is today or in the past.
  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : toISODate(new Date())
  const created = await materializeRecurring(userId, today)
  const fresh = await db.recurringExpense.findUniqueOrThrow({ where: { id: rule.id }, include: { category: true } })
  return NextResponse.json({ recurring: toRecurringDTO(fresh), created }, { status: 201 })
})

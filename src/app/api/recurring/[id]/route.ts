import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { toRecurringDTO, validateRecurring } from '@/lib/recurring-input'

export const PUT = withUser<{ id: string }>('PUT /api/recurring/[id]', async (req, ctx, { userId }) => {
  const { id } = await ctx.params
  const existing = await db.recurringExpense.findFirst({ where: { id, userId } })
  if (!existing) return jsonError('Recurring expense not found', 404)
  const body = (await req.json()) as Record<string, unknown>

  // Pause / resume only
  if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
    const rule = await db.recurringExpense.update({
      where: { id },
      data: { active: body.active },
      include: { category: true },
    })
    return NextResponse.json({ recurring: toRecurringDTO(rule) })
  }

  const v = await validateRecurring(userId, { ...existing, amount: existing.amount, ...body })
  if ('error' in v) return jsonError(v.error)
  const rule = await db.recurringExpense.update({
    where: { id },
    data: {
      amountCents: v.amountCents,
      merchant: v.merchant,
      description: v.description,
      categoryId: v.categoryId,
      frequency: v.frequency,
      // Changing the schedule restarts it from the new start date.
      ...(v.startDate !== existing.startDate || v.frequency !== existing.frequency
        ? { startDate: v.startDate, nextDate: v.startDate > existing.nextDate ? v.startDate : existing.nextDate }
        : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    },
    include: { category: true },
  })
  return NextResponse.json({ recurring: toRecurringDTO(rule) })
})

export const DELETE = withUser<{ id: string }>('DELETE /api/recurring/[id]', async (_req, ctx, { userId }) => {
  const { id } = await ctx.params
  // Expenses already created keep existing (their recurringId is set to null).
  const removed = await db.recurringExpense.deleteMany({ where: { id, userId } })
  if (removed.count === 0) return jsonError('Recurring expense not found', 404)
  return NextResponse.json({ ok: true })
})

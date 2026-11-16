import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { budgetStatusFor } from '@/lib/budget-status'
import { toExpenseDTO } from '@/lib/dto'
import { deleteReceipt } from '@/lib/receipts'
import { parseItems, validateExpenseBody } from '@/lib/expense-input'

export const PUT = withUser<{ id: string }>('PUT /api/expenses/[id]', async (req, ctx, { userId }) => {
  const { id } = await ctx.params
  const existing = await db.expense.findFirst({ where: { id, userId } })
  if (!existing) return jsonError('Expense not found', 404)

  const body = (await req.json()) as Record<string, unknown>
  const v = await validateExpenseBody(userId, body)
  if ('error' in v) return jsonError(v.error)
  const items = 'items' in body ? parseItems(body.items) : existing.items

  const expense = await db.expense.update({
    where: { id },
    data: {
      amountCents: v.amountCents,
      merchant: v.merchant,
      date: v.date,
      categoryId: v.categoryId,
      description: 'description' in body ? v.description : existing.description,
      items,
    },
    include: { category: true },
  })
  const budgetStatus = await budgetStatusFor(userId, expense.categoryId, expense.date)
  return NextResponse.json({ expense: toExpenseDTO(expense), budgetStatus })
})

export const DELETE = withUser<{ id: string }>('DELETE /api/expenses/[id]', async (_req, ctx, { userId }) => {
  const { id } = await ctx.params
  const existing = await db.expense.findFirst({ where: { id, userId } })
  if (!existing) return jsonError('Expense not found', 404)
  await db.expense.delete({ where: { id } })
  await deleteReceipt(existing.receiptImage)
  return NextResponse.json({ ok: true })
})

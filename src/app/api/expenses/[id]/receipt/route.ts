import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { receiptResponse } from '@/lib/receipts'

export const GET = withUser<{ id: string }>('GET /api/expenses/[id]/receipt', async (_req, ctx, { userId }) => {
  const { id } = await ctx.params
  const expense = await db.expense.findFirst({ where: { id, userId }, select: { receiptImage: true } })
  if (!expense?.receiptImage) return jsonError('Receipt not found', 404)
  const res = await receiptResponse(expense.receiptImage)
  return res ?? jsonError('Receipt not found', 404)
})

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'

export const DELETE = withUser<{ id: string }>('DELETE /api/income/[id]', async (_req, ctx, { userId }) => {
  const { id } = await ctx.params
  const removed = await db.income.deleteMany({ where: { id, userId } })
  if (removed.count === 0) return jsonError('Income entry not found', 404)
  return NextResponse.json({ ok: true })
})

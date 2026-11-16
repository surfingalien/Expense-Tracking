import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, parseAmountCents, withUser } from '@/lib/api'
import { toCategoryDTO } from '@/lib/dto'
import type { Prisma } from '@/generated/prisma/client'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const PUT = withUser<{ id: string }>('PUT /api/categories/[id]', async (req, ctx, { userId }) => {
  const { id } = await ctx.params
  const existing = await db.category.findFirst({ where: { id, userId } })
  if (!existing) return jsonError('Category not found', 404)

  const body = (await req.json()) as Record<string, unknown>
  const data: Prisma.CategoryUpdateInput = {}
  if (typeof body.name === 'string' && body.name.trim()) {
    const name = body.name.trim().slice(0, 60)
    const clash = await db.category.findFirst({ where: { userId, name } })
    if (clash && clash.id !== id) return jsonError('A category with this name already exists', 409)
    data.name = name
  }
  if (typeof body.color === 'string' && HEX_COLOR.test(body.color)) data.color = body.color
  if (typeof body.icon === 'string' && body.icon.length > 0) data.icon = body.icon.slice(0, 40)
  if ('budget' in body) data.budgetCents = parseAmountCents(body.budget)

  const category = await db.category.update({ where: { id }, data })
  return NextResponse.json({ category: toCategoryDTO(category) })
})

export const DELETE = withUser<{ id: string }>('DELETE /api/categories/[id]', async (_req, ctx, { userId }) => {
  const { id } = await ctx.params
  const existing = await db.category.findFirst({
    where: { id, userId },
    include: { _count: { select: { expenses: true, recurring: true } } },
  })
  if (!existing) return jsonError('Category not found', 404)
  if (existing._count.expenses > 0 || existing._count.recurring > 0) {
    const what = existing._count.expenses > 0 ? `${existing._count.expenses} expense(s)` : 'recurring expenses'
    return jsonError(`Cannot delete "${existing.name}" — it still has ${what}`, 409)
  }
  await db.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})

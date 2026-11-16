import { NextResponse } from 'next/server'
import { db, fromCents } from '@/lib/db'
import { jsonError, parseAmountCents, withUser } from '@/lib/api'
import { monthBounds } from '@/lib/budget-status'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { toCategoryDTO } from '@/lib/dto'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const GET = withUser('GET /api/categories', async (req, _ctx, { userId }) => {
  const month = req.nextUrl.searchParams.get('month')
  const monthMatch = month && /^\d{4}-\d{2}$/.test(month) ? month : null

  const [categories, counts, monthAgg] = await Promise.all([
    db.category.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    db.expense.groupBy({ by: ['categoryId'], where: { userId }, _count: { _all: true } }),
    monthMatch
      ? db.expense.groupBy({
          by: ['categoryId'],
          where: { userId, date: { gte: monthBounds(monthMatch).start, lte: monthBounds(monthMatch).end } },
          _sum: { amountCents: true },
        })
      : Promise.resolve([] as { categoryId: string; _sum: { amountCents: number | null } }[]),
  ])

  const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]))
  const monthMap = new Map(monthAgg.map((m) => [m.categoryId, fromCents(m._sum.amountCents || 0)]))

  const result = categories.map((c) => ({
    ...toCategoryDTO(c),
    expenseCount: countMap.get(c.id) || 0,
    monthTotal: monthMap.get(c.id) || 0,
  }))
  return NextResponse.json({ categories: result })
})

export const POST = withUser('POST /api/categories', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  const color = typeof body.color === 'string' && HEX_COLOR.test(body.color) ? body.color : '#10b981'
  const icon = typeof body.icon === 'string' && body.icon.length > 0 ? body.icon.slice(0, 40) : 'Tag'
  const budgetCents = parseAmountCents(body.budget)

  if (!name) return jsonError('Name is required')
  const existing = await db.category.findFirst({ where: { userId, name } })
  if (existing) return jsonError('A category with this name already exists', 409)

  const category = await db.category.create({
    data: { userId, name, color, icon, budgetCents, isDefault: DEFAULT_CATEGORIES.some((d) => d.name === name) },
  })
  return NextResponse.json({ category: toCategoryDTO(category) }, { status: 201 })
})

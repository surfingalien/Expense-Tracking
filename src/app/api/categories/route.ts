import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { DEFAULT_CATEGORIES } from '@/lib/categories'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const today = sp.get('today') || undefined
    await ensureSeed(today)
    const month = sp.get('month')
    const monthMatch = month && /^\d{4}-\d{2}$/.test(month) ? month : null

    const [categories, counts, monthAgg] = await Promise.all([
      db.category.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
      db.expense.groupBy({ by: ['categoryId'], _count: { _all: true } }),
      monthMatch
        ? db.expense.groupBy({
            by: ['categoryId'],
            where: { date: { gte: `${monthMatch}-01`, lte: `${monthMatch}-31` } },
            _sum: { amount: true },
          })
        : Promise.resolve([] as { categoryId: string; _sum: { amount: number | null } }[]),
    ])

    const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]))
    const monthMap = new Map(monthAgg.map((m) => [m.categoryId, Math.round((m._sum.amount || 0) * 100) / 100]))

    const result = categories.map((c) => ({
      ...c,
      expenseCount: countMap.get(c.id) || 0,
      monthTotal: monthMap.get(c.id) || 0,
    }))
    return NextResponse.json({ categories: result })
  } catch (err) {
    console.error('GET /api/categories failed:', err)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
    const color = typeof body.color === 'string' && HEX_COLOR.test(body.color) ? body.color : '#10b981'
    const icon = typeof body.icon === 'string' && body.icon.length > 0 ? body.icon.slice(0, 40) : 'Tag'
    const budgetRaw = Number(body.budget)
    const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.round(budgetRaw * 100) / 100 : null

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const existing = await db.category.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })

    const category = await db.category.create({
      data: { name, color, icon, budget, isDefault: DEFAULT_CATEGORIES.some((d) => d.name === name) },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    console.error('POST /api/categories failed:', err)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

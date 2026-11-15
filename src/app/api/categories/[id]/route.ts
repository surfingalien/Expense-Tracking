import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const body = (await req.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      const name = body.name.trim().slice(0, 60)
      const clash = await db.category.findUnique({ where: { name } })
      if (clash && clash.id !== id) {
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
      }
      data.name = name
    }
    if (typeof body.color === 'string' && HEX_COLOR.test(body.color)) data.color = body.color
    if (typeof body.icon === 'string' && body.icon.length > 0) data.icon = body.icon.slice(0, 40)
    if ('budget' in body) {
      const raw = Number(body.budget)
      data.budget = Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null
    }

    const category = await db.category.update({ where: { id }, data })
    return NextResponse.json({ category })
  } catch (err) {
    console.error('PUT /api/categories/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = await db.category.findUnique({ where: { id }, include: { _count: { select: { expenses: true } } } })
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    if (existing._count.expenses > 0) {
      return NextResponse.json(
        { error: `Cannot delete "${existing.name}" — it still has ${existing._count.expenses} expense(s)` },
        { status: 409 },
      )
    }
    await db.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/categories/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { budgetStatusFor } from '@/lib/budget-status'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type RouteContext = { params: Promise<{ id: string }> }

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) return badRequest('Expense not found', 404)

    const body = (await req.json()) as Record<string, unknown>
    const amount = Number(body.amount)
    const merchant = typeof body.merchant === 'string' ? body.merchant.trim().slice(0, 120) : ''
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''

    if (!Number.isFinite(amount) || amount <= 0) return badRequest('Amount must be a positive number')
    if (!merchant) return badRequest('Merchant is required')
    if (!ISO_DATE.test(date)) return badRequest('Date must be in YYYY-MM-DD format')
    if (!categoryId) return badRequest('Category is required')
    const category = await db.category.findUnique({ where: { id: categoryId } })
    if (!category) return badRequest('Category not found')

    const description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : existing.description
    const items = typeof body.items === 'string' ? body.items.slice(0, 100000) : existing.items

    const expense = await db.expense.update({
      where: { id },
      data: { amount, merchant, date, categoryId, description, items },
      include: { category: true },
    })
    const budgetStatus = await budgetStatusFor(expense.categoryId, expense.date)
    return NextResponse.json({ expense, budgetStatus })
  } catch (err) {
    console.error('PUT /api/expenses/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) return badRequest('Expense not found', 404)
    await db.expense.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/expenses/[id] failed:', err)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}

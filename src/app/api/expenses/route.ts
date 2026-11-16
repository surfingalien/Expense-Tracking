import { NextResponse } from 'next/server'
import { db, fromCents } from '@/lib/db'
import { ISO_DATE, jsonError, withUser } from '@/lib/api'
import { budgetStatusFor } from '@/lib/budget-status'
import { toExpenseDTO } from '@/lib/dto'
import { isOwnReceiptPath } from '@/lib/receipts'
import type { Prisma } from '@/generated/prisma/client'
import { parseItems, validateExpenseBody } from '@/lib/expense-input'

const DEFAULT_PAGE = 50
const MAX_PAGE = 500

export const GET = withUser('GET /api/expenses', async (req, _ctx, { userId }) => {
  const sp = req.nextUrl.searchParams
  const start = sp.get('start')
  const end = sp.get('end')
  const categoryId = sp.get('categoryId') || undefined
  const q = (sp.get('q') || '').trim()
  const sort = sp.get('sort') || 'date_desc'
  const limit = Math.min(Math.max(Number(sp.get('limit')) || DEFAULT_PAGE, 1), MAX_PAGE)
  const offset = Math.max(Number(sp.get('offset')) || 0, 0)

  const where: Prisma.ExpenseWhereInput = { userId }
  const date: Prisma.StringFilter = {}
  if (start && ISO_DATE.test(start)) date.gte = start
  if (end && ISO_DATE.test(end)) date.lte = end
  if (date.gte || date.lte) where.date = date
  if (categoryId && categoryId !== 'all') where.categoryId = categoryId
  if (q) {
    where.OR = [
      { merchant: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const orderBy: Prisma.ExpenseOrderByWithRelationInput[] =
    sort === 'date_asc'
      ? [{ date: 'asc' }, { createdAt: 'asc' }]
      : sort === 'amount_desc'
        ? [{ amountCents: 'desc' }, { date: 'desc' }]
        : sort === 'amount_asc'
          ? [{ amountCents: 'asc' }, { date: 'desc' }]
          : [{ date: 'desc' }, { createdAt: 'desc' }]

  const [rows, agg] = await Promise.all([
    db.expense.findMany({ where, include: { category: true }, orderBy, skip: offset, take: limit }),
    db.expense.aggregate({ where, _count: { _all: true }, _sum: { amountCents: true } }),
  ])
  const count = agg._count._all
  return NextResponse.json({
    expenses: rows.map(toExpenseDTO),
    summary: { count, total: fromCents(agg._sum.amountCents || 0) },
    hasMore: offset + rows.length < count,
    nextOffset: offset + rows.length,
  })
})

export const POST = withUser('POST /api/expenses', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as Record<string, unknown>
  const v = await validateExpenseBody(userId, body)
  if ('error' in v) return jsonError(v.error)
  const source = body.source === 'scan' ? 'scan' : 'manual'
  const expense = await db.expense.create({
    data: {
      userId,
      amountCents: v.amountCents,
      merchant: v.merchant,
      date: v.date,
      description: v.description,
      categoryId: v.categoryId,
      items: parseItems(body.items),
      // Only accept a receipt the scan endpoint stored for this same user.
      receiptImage: isOwnReceiptPath(userId, body.receiptImage) ? body.receiptImage : null,
      source,
    },
    include: { category: true },
  })
  const budgetStatus = await budgetStatusFor(userId, expense.categoryId, expense.date)
  return NextResponse.json({ expense: toExpenseDTO(expense), budgetStatus }, { status: 201 })
})

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { budgetStatusFor } from '@/lib/budget-status'
import type { ExpenseItem } from '@/lib/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RECEIPT_LENGTH = 2_500_000 // ~2.5MB data URL

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const today = sp.get('today') || undefined
    await ensureSeed(today)

    const start = sp.get('start')
    const end = sp.get('end')
    const categoryId = sp.get('categoryId') || undefined
    const q = (sp.get('q') || '').trim().toLowerCase()
    const sort = sp.get('sort') || 'date_desc'
    const limit = Math.min(Number(sp.get('limit')) || 1000, 2000)

    const where: Record<string, unknown> = {}
    if (start && ISO_DATE.test(start) && end && ISO_DATE.test(end)) {
      where.date = { gte: start, lte: end }
    } else if (start && ISO_DATE.test(start)) {
      where.date = { gte: start }
    } else if (end && ISO_DATE.test(end)) {
      where.date = { lte: end }
    }
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId

    const rows = await db.expense.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    let expenses = rows
    if (q) {
      expenses = rows.filter(
        (e) =>
          e.merchant.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          e.category.name.toLowerCase().includes(q),
      )
    }

    switch (sort) {
      case 'date_asc':
        expenses = [...expenses].sort(
          (a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)),
        )
        break
      case 'amount_desc':
        expenses = [...expenses].sort((a, b) => b.amount - a.amount)
        break
      case 'amount_asc':
        expenses = [...expenses].sort((a, b) => a.amount - b.amount)
        break
      default:
        break
    }

    const total = expenses.reduce((s, e) => s + e.amount, 0)
    return NextResponse.json({
      expenses,
      summary: { count: expenses.length, total: Math.round(total * 100) / 100 },
    })
  } catch (err) {
    console.error('GET /api/expenses failed:', err)
    return NextResponse.json({ error: 'Failed to load expenses' }, { status: 500 })
  }
}

function parseItems(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const items: ExpenseItem[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const obj = it as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.slice(0, 120) : ''
    const price = Number(obj.price)
    if (!name || !Number.isFinite(price)) continue
    const qty = Number(obj.qty)
    items.push({
      name,
      price: Math.round(price * 100) / 100,
      qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : null,
    })
  }
  return items.length ? JSON.stringify(items.slice(0, 50)) : null
}

async function validateBody(body: Record<string, unknown>) {
  const amount = Number(body.amount)
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim().slice(0, 120) : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
  const description =
    typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : null
  const receiptImage =
    typeof body.receiptImage === 'string' &&
    body.receiptImage.length > 0 &&
    body.receiptImage.length <= MAX_RECEIPT_LENGTH
      ? body.receiptImage
      : null
  const source = body.source === 'scan' ? 'scan' : body.source === 'demo' ? 'demo' : 'manual'

  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be a positive number' }
  if (!merchant) return { error: 'Merchant is required' }
  if (!ISO_DATE.test(date)) return { error: 'Date must be in YYYY-MM-DD format' }
  if (!categoryId) return { error: 'Category is required' }
  const category = await db.category.findUnique({ where: { id: categoryId } })
  if (!category) return { error: 'Category not found' }

  return {
    amount,
    merchant,
    date,
    categoryId,
    description,
    receiptImage,
    source,
    items: parseItems(body.items),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const v = await validateBody(body)
    if ('error' in v && v.error) return badRequest(v.error)
    const data = v as Exclude<typeof v, { error: string }>
    const expense = await db.expense.create({
      data: {
        amount: data.amount,
        merchant: data.merchant,
        date: data.date,
        description: data.description,
        items: data.items,
        receiptImage: data.receiptImage,
        source: data.source,
        categoryId: data.categoryId,
      },
      include: { category: true },
    })
    const budgetStatus = await budgetStatusFor(expense.categoryId, expense.date)
    return NextResponse.json({ expense, budgetStatus }, { status: 201 })
  } catch (err) {
    console.error('POST /api/expenses failed:', err)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}

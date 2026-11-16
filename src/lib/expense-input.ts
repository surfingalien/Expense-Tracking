import { db } from '@/lib/db'
import { ISO_DATE, parseAmountCents } from '@/lib/api'
import type { ExpenseItem } from '@/lib/types'

export function parseItems(raw: unknown): string | null {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
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

export async function validateExpenseBody(userId: string, body: Record<string, unknown>) {
  const amountCents = parseAmountCents(body.amount)
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim().slice(0, 120) : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : null

  if (amountCents == null) return { error: 'Amount must be a positive number' } as const
  if (!merchant) return { error: 'Merchant is required' } as const
  if (!ISO_DATE.test(date)) return { error: 'Date must be in YYYY-MM-DD format' } as const
  if (!categoryId) return { error: 'Category is required' } as const
  const category = await db.category.findFirst({ where: { id: categoryId, userId } })
  if (!category) return { error: 'Category not found' } as const

  return { ok: true, amountCents, merchant, date, categoryId, description } as const
}

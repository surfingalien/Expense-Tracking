import { db } from '@/lib/db'
import { ISO_DATE, parseAmountCents } from '@/lib/api'
import { toCategoryDTO } from '@/lib/dto'
import { FREQUENCIES, type Frequency } from '@/lib/recurring'
import type { RecurringDTO } from '@/lib/types'

export function toRecurringDTO(r: {
  id: string
  amount: number
  merchant: string
  description: string | null
  categoryId: string
  frequency: string
  startDate: string
  nextDate: string
  active: boolean
  category: { id: string; name: string; icon: string; color: string; budget: number | null; isDefault: boolean }
}): RecurringDTO {
  return {
    id: r.id,
    amount: r.amount,
    merchant: r.merchant,
    description: r.description,
    categoryId: r.categoryId,
    category: toCategoryDTO(r.category),
    frequency: r.frequency as Frequency,
    startDate: r.startDate,
    nextDate: r.nextDate,
    active: r.active,
  }
}

export async function validateRecurring(userId: string, body: Record<string, unknown>) {
  const amountCents = parseAmountCents(body.amount)
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim().slice(0, 120) : ''
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
  const frequency = FREQUENCIES.includes(body.frequency as Frequency) ? (body.frequency as Frequency) : null
  const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : null
  if (amountCents == null) return { error: 'Amount must be a positive number' } as const
  if (!merchant) return { error: 'Name is required' } as const
  if (!frequency) return { error: 'Frequency must be weekly, monthly or yearly' } as const
  if (!ISO_DATE.test(startDate)) return { error: 'Start date must be in YYYY-MM-DD format' } as const
  const category = await db.category.findFirst({ where: { id: categoryId, userId } })
  if (!category) return { error: 'Category not found' } as const
  return { ok: true, amountCents, merchant, categoryId, frequency, startDate, description } as const
}

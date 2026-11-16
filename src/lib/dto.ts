// Maps database rows to the JSON shapes the client expects (amounts in major
// units, no internal columns like userId / *Cents).
import { receiptUrl } from '@/lib/receipts'
import type { CategoryInfo, ExpenseDTO } from '@/lib/types'

type CategoryRow = {
  id: string
  name: string
  icon: string
  color: string
  budget: number | null
  isDefault: boolean
}

export function toCategoryDTO(c: CategoryRow): CategoryInfo {
  return { id: c.id, name: c.name, icon: c.icon, color: c.color, budget: c.budget, isDefault: c.isDefault }
}

type ExpenseRow = {
  id: string
  amount: number
  merchant: string
  date: string
  description: string | null
  items: string | null
  receiptImage: string | null
  source: string
  isDemo: boolean
  categoryId: string
  recurringId: string | null
  createdAt: Date
  category: CategoryRow
}

export function toExpenseDTO(e: ExpenseRow): ExpenseDTO {
  return {
    id: e.id,
    amount: e.amount,
    merchant: e.merchant,
    date: e.date,
    description: e.description,
    items: e.items,
    receiptImage: receiptUrl(e.id, e.receiptImage),
    source: e.source,
    isDemo: e.isDemo,
    categoryId: e.categoryId,
    recurringId: e.recurringId,
    category: toCategoryDTO(e.category),
    createdAt: e.createdAt.toISOString(),
  }
}

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryIcon } from './category-icon'
import { formatCurrency } from '@/lib/format'
import type { CategoryInfo, ExpenseItem } from '@/lib/types'

export interface ExpenseFormValue {
  amount: string
  merchant: string
  date: string
  categoryId: string
  description: string
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateForm(value: ExpenseFormValue): Record<string, string> {
  const errors: Record<string, string> = {}
  const amount = Number(value.amount)
  if (!value.amount || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0'
  }
  if (!value.merchant.trim()) errors.merchant = 'Merchant is required'
  if (!ISO_DATE_RE.test(value.date)) errors.date = 'Pick a date'
  if (!value.categoryId) errors.categoryId = 'Choose a category'
  return errors
}

export function toPayload(value: ExpenseFormValue, extras?: { items?: string | null; receiptImage?: string | null; source?: string }) {
  return {
    amount: Math.round(Number(value.amount) * 100) / 100,
    merchant: value.merchant.trim(),
    date: value.date,
    categoryId: value.categoryId,
    description: value.description.trim() || null,
    items: extras?.items ?? null,
    receiptImage: extras?.receiptImage ?? null,
    source: extras?.source ?? 'manual',
  }
}

export function ExpenseFormFields({
  value,
  onChange,
  categories,
  errors,
  merchants = [],
  disabled = false,
}: {
  value: ExpenseFormValue
  onChange: (next: ExpenseFormValue) => void
  categories: CategoryInfo[]
  errors: Record<string, string>
  merchants?: string[]
  disabled?: boolean
}) {
  const set = (patch: Partial<ExpenseFormValue>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="exp-amount">
          Amount <span className="text-rose-500">*</span>
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
            $
          </span>
          <Input
            id="exp-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className="pl-7 text-base font-semibold"
            value={value.amount}
            disabled={disabled}
            onChange={(e) => set({ amount: e.target.value })}
            aria-invalid={!!errors.amount}
          />
        </div>
        {errors.amount && <p className="text-xs text-rose-500">{errors.amount}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exp-merchant">
          Merchant <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="exp-merchant"
          list="known-merchants"
          placeholder="e.g. Starbucks"
          value={value.merchant}
          disabled={disabled}
          onChange={(e) => set({ merchant: e.target.value })}
          aria-invalid={!!errors.merchant}
        />
        <datalist id="known-merchants">
          {merchants.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {errors.merchant && <p className="text-xs text-rose-500">{errors.merchant}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exp-date">
          Date <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="exp-date"
          type="date"
          value={value.date}
          disabled={disabled}
          onChange={(e) => set({ date: e.target.value })}
          aria-invalid={!!errors.date}
        />
        {errors.date && <p className="text-xs text-rose-500">{errors.date}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>
          Category <span className="text-rose-500">*</span>
        </Label>
        <Select value={value.categoryId} onValueChange={(v) => set({ categoryId: v })} disabled={disabled}>
          <SelectTrigger aria-invalid={!!errors.categoryId} aria-label="Category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${c.color}1f` }}
                  >
                    <CategoryIcon name={c.icon} className="h-3 w-3" />
                  </span>
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-xs text-rose-500">{errors.categoryId}</p>}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="exp-desc">Description</Label>
        <Input
          id="exp-desc"
          placeholder="Optional note, e.g. team lunch"
          value={value.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
    </div>
  )
}

export function ItemsList({ items }: { items: ExpenseItem[] }) {
  if (!items.length) return null
  const sum = items.reduce((s, i) => s + i.price, 0)
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">Detected line items ({items.length})</p>
        <p className="text-xs font-semibold tabular-nums text-gray-500">sum {formatCurrency(sum)}</p>
      </div>
      <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {items.map((item, idx) => (
          <li key={`${item.name}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-gray-700">
              {item.qty ? `${item.qty} × ` : ''}
              {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-gray-600">{formatCurrency(item.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReceiptPreview({ image }: { image: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
      <img
        src={image}
        alt="Scanned receipt"
        className="h-24 w-20 cursor-zoom-in rounded-lg border border-gray-200 object-cover"
        onClick={() => window.open(image, '_blank')}
      />
      <div className="min-w-0 text-xs text-gray-500">
        <p className="font-semibold text-gray-700">Receipt attached</p>
        <p className="mt-1 leading-relaxed">
          The scanned receipt image is saved with this expense. Click the thumbnail to view it in full size.
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionCard } from './ui-bits'
import { CategoryIcon } from './category-icon'
import { useCreateRecurring, useDeleteRecurring, useRecurring, useUpdateRecurring } from './hooks'
import { currencySymbol, formatCurrency } from '@/lib/format'
import { toISODate } from '@/lib/period'
import type { CategoryInfo, RecurringFrequency } from '@/lib/types'

const FREQ_LABEL: Record<RecurringFrequency, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }
const PER_MONTH: Record<RecurringFrequency, number> = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }

function AddRecurringDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  categories: CategoryInfo[]
}) {
  const create = useCreateRecurring()
  const today = toISODate(new Date())
  const [form, setForm] = useState({
    merchant: '',
    amount: '',
    categoryId: '',
    frequency: 'monthly' as RecurringFrequency,
    startDate: today,
  })
  const sym = currencySymbol()
  const categoryId = form.categoryId || categories.find((c) => c.name === 'Bills & Utilities')?.id || categories[0]?.id || ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.merchant.trim()) return void toast.error('Give it a name, e.g. "Rent" or "Netflix"')
    if (!Number.isFinite(amount) || amount <= 0) return void toast.error('Enter an amount greater than zero')
    try {
      const res = await create.mutateAsync({ ...form, merchant: form.merchant.trim(), amount, categoryId })
      toast.success(
        res.created > 0
          ? `Recurring expense added (${res.created} past occurrence${res.created === 1 ? '' : 's'} recorded)`
          : 'Recurring expense added',
      )
      setForm({ merchant: '', amount: '', categoryId: '', frequency: 'monthly', startDate: today })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add recurring expense')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add recurring expense</DialogTitle>
          <DialogDescription>
            Rent, subscriptions, bills… Each occurrence is added to your expenses automatically on its due date.
          </DialogDescription>
        </DialogHeader>
        <form id="recurring-form" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Name</Label>
            <Input id="rec-name" placeholder="e.g. Rent" maxLength={120} value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{sym}</span>
                <Input
                  id="rec-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={sym.length > 1 ? 'pl-11' : 'pl-7'}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-freq">Repeats</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as RecurringFrequency }))}>
                <SelectTrigger id="rec-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQ_LABEL) as RecurringFrequency[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {FREQ_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-cat">Category</Label>
              <Select value={categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger id="rec-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-start">First payment</Label>
              <Input id="rec-start" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="recurring-form" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RecurringSection({ categories }: { categories: CategoryInfo[] }) {
  const { data, isLoading } = useRecurring()
  const update = useUpdateRecurring()
  const remove = useDeleteRecurring()
  const [addOpen, setAddOpen] = useState(false)
  const rules = data?.recurring ?? []
  const monthly = rules.filter((r) => r.active).reduce((s, r) => s + r.amount * PER_MONTH[r.frequency], 0)

  return (
    <SectionCard
      title="Recurring expenses"
      action={
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={categories.length === 0}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      }
    >
      {!isLoading && rules.length > 0 && (
        <p className="mb-3 text-sm text-gray-500">
          About <span className="font-semibold text-gray-900">{formatCurrency(monthly)}</span> per month in fixed costs.
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-center">
          <Repeat className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No recurring expenses yet</p>
          <p className="max-w-xs text-xs text-gray-400">Add rent, subscriptions or bills once and they are logged for you every period.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {rules.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 py-2.5 ${r.active ? '' : 'opacity-50'}`}>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${r.category.color}1a`, color: r.category.color }}
              >
                <CategoryIcon name={r.category.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.merchant}</p>
                <p className="truncate text-xs text-gray-400">
                  {FREQ_LABEL[r.frequency]} · {r.category.name} · {r.active ? `next ${r.nextDate}` : 'paused'}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-gray-700"
                aria-label={r.active ? `Pause ${r.merchant}` : `Resume ${r.merchant}`}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: r.id, payload: { active: !r.active } })}
              >
                {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-rose-600"
                aria-label={`Delete ${r.merchant}`}
                disabled={remove.isPending}
                onClick={async () => {
                  try {
                    await remove.mutateAsync(r.id)
                    toast.success(`Stopped "${r.merchant}". Past expenses were kept.`)
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Delete failed')
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AddRecurringDialog open={addOpen} onOpenChange={setAddOpen} categories={categories} />
    </SectionCard>
  )
}

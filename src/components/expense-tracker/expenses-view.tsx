'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowUpDown,
  Keyboard,
  Pencil,
  ScanLine,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories, useDeleteExpense, useExpenses } from './hooks'
import { SectionCard } from './ui-bits'
import { CategoryIcon } from './category-icon'
import { formatCurrency } from '@/lib/format'
import { friendlyDayLabel, getPeriodRange, toISODate, type PeriodKey } from '@/lib/period'
import type { ExpenseDTO } from '@/lib/types'

const PERIOD_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
]

function rangeFor(key: string): { start?: string; end?: string } {
  if (key === 'all') return {}
  const p = key as PeriodKey
  const { start, end } = getPeriodRange(p, toISODate(new Date()))
  return { start, end }
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'scan') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <ScanLine className="h-3 w-3" /> Scan
      </span>
    )
  }
  if (source === 'demo') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
        Demo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
      <Keyboard className="h-3 w-3" /> Manual
    </span>
  )
}

function ExpenseRow({
  expense,
  today,
  onEdit,
  onDelete,
}: {
  expense: ExpenseDTO
  today: string
  onEdit: (e: ExpenseDTO) => void
  onDelete: (e: ExpenseDTO) => void
}) {
  const c = expense.category
  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:bg-gray-50/80 md:grid-cols-[92px_1fr_150px_90px_96px_72px] md:rounded-lg md:border-0 md:border-b md:px-2 md:py-2.5">
      <div className="text-xs text-gray-500 md:order-1">
        <div className="font-medium text-gray-700">{friendlyDayLabel(expense.date, today)}</div>
        <div className="md:hidden">{expense.date}</div>
      </div>
      <div className="min-w-0 md:order-2">
        <p className="truncate text-sm font-medium text-gray-900">{expense.merchant}</p>
        {expense.description && <p className="truncate text-xs text-gray-500">{expense.description}</p>}
      </div>
      <div className="hidden md:block md:order-3">
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: `${c.color}17`, color: c.color }}
        >
          <CategoryIcon name={c.icon} className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.name}</span>
        </span>
      </div>
      <div className="hidden md:block md:order-4">
        <SourceBadge source={expense.source} />
      </div>
      <div className="text-right text-sm font-semibold tabular-nums text-gray-900 md:order-5">
        {formatCurrency(expense.amount)}
      </div>
      <div className="flex justify-end gap-1 md:order-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-emerald-700"
          onClick={() => onEdit(expense)}
          aria-label={`Edit ${expense.merchant}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-rose-600"
          onClick={() => onDelete(expense)}
          aria-label={`Delete ${expense.merchant}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ExpensesView({
  onEdit,
  onAdd,
}: {
  onEdit: (expense: ExpenseDTO) => void
  onAdd: () => void
}) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [period, setPeriod] = useState('month')
  const [categoryId, setCategoryId] = useState('all')
  const [sort, setSort] = useState('date_desc')
  const [pendingDelete, setPendingDelete] = useState<ExpenseDTO | null>(null)

  const { data: catData } = useCategories()
  const categories = catData?.categories ?? []

  const filters = useMemo(() => {
    const { start, end } = rangeFor(period)
    return { start, end, categoryId, q: debouncedQ || undefined, sort }
  }, [period, categoryId, debouncedQ, sort])

  const { data, isLoading, isError, error, refetch, isFetching } = useExpenses(filters)
  const deleteMutation = useDeleteExpense()

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300)
    return () => window.clearTimeout(t)
  }, [q])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteMutation.mutateAsync(pendingDelete.id)
      toast.success(`Deleted "${pendingDelete.merchant}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setPendingDelete(null)
    }
  }

  const summary = data?.summary

  return (
    <SectionCard
      title="Expenses"
      action={
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={onAdd} className="hidden sm:inline-flex">
            <Wallet className="h-4 w-4 text-emerald-600" /> Add
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search merchant, note or category…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search expenses"
          />
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]" aria-label="Period filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[170px]" aria-label="Category filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]" aria-label="Sort order">
            <span className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="amount_desc">Highest amount</SelectItem>
            <SelectItem value="amount_asc">Lowest amount</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        {isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <p className="text-gray-500">
            <span className="font-semibold text-gray-900">{summary?.count ?? 0}</span> expenses ·{' '}
            <span className="font-semibold text-gray-900">{formatCurrency(summary?.total ?? 0)}</span> total
            {isFetching && <span className="ml-2 text-xs text-gray-400">updating…</span>}
          </p>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load expenses: {error instanceof Error ? error.message : 'unknown error'}{' '}
          <button className="font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (data?.expenses.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <Wallet className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No expenses match these filters</p>
          <p className="max-w-xs text-xs text-gray-400">
            Try widening the period, clearing the search, or add a new expense / scan a receipt.
          </p>
          <Button size="sm" onClick={onAdd} className="mt-1">
            Add expense
          </Button>
        </div>
      ) : (
        <div className="max-h-[62vh] overflow-y-auto pr-1 md:pb-1">
          <div className="hidden px-2 pb-1 md:grid md:grid-cols-[92px_1fr_150px_90px_96px_72px] md:items-center md:gap-3">
            {['Date', 'Merchant', 'Category', 'Source', '', ''].map((h, i) => (
              <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${i === 4 ? 'text-right' : ''}`}>
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-gray-50 md:divide-y-0">
            {data?.expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} today={toISODate(new Date())} onEdit={onEdit} onDelete={setPendingDelete} />
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.merchant}&rdquo; for {formatCurrency(pendingDelete.amount)} on{' '}
                  {pendingDelete.date} will be permanently removed. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}

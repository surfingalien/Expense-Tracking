'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, PiggyBank, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './hooks'
import { SectionCard } from './ui-bits'
import { CategoryIcon } from './category-icon'
import { CATEGORY_PALETTE } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'
import { formatMonthKey, toISODate } from '@/lib/period'
import type { CategoryWithStats } from '@/lib/types'

function AddCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_PALETTE[0])
  const [budget, setBudget] = useState('')
  const [lastOpen, setLastOpen] = useState(false)
  const createMutation = useCreateCategory()

  // Reset fields when the dialog opens (render-time adjustment)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName('')
      setColor(CATEGORY_PALETTE[Math.floor(Math.random() * CATEGORY_PALETTE.length)])
      setBudget('')
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Give the category a name')
      return
    }
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        color,
        budget: budget ? Number(budget) : null,
      })
      toast.success(`Category "${name.trim()}" created`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create category')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>Create a custom spending category with an optional monthly budget.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" placeholder="e.g. Pets" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-gray-900 ring-offset-2' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-budget">Monthly budget (optional)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <Input
                id="cat-budget"
                type="number"
                min="0"
                step="10"
                placeholder="e.g. 200"
                className="pl-7"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending && <Check className="h-4 w-4 animate-pulse" />}
            Create category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BudgetRow({ category, month }: { category: CategoryWithStats; month: string }) {
  const [budgetInput, setBudgetInput] = useState(category.budget != null ? String(category.budget) : '')
  const [dirty, setDirty] = useState(false)
  const [lastBudget, setLastBudget] = useState(category.budget)
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  // Sync the input when the server-side budget changes (render-time adjustment)
  if (category.budget !== lastBudget) {
    setLastBudget(category.budget)
    setBudgetInput(category.budget != null ? String(category.budget) : '')
    setDirty(false)
  }

  const budget = category.budget ?? 0
  const pct = budget > 0 ? Math.round((category.monthTotal / budget) * 100) : 0
  const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'

  async function saveBudget() {
    const raw = budgetInput.trim()
    const value = raw ? Number(raw) : null
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) <= 0)) {
      toast.error('Budget must be a positive number')
      return
    }
    try {
      await updateMutation.mutateAsync({ id: category.id, payload: { budget: value } })
      toast.success(
        value ? `${category.name} budget set to ${formatCurrency(value)}` : `${category.name} budget removed`,
      )
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update budget')
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(category.id)
      toast.success(`Category "${category.name}" deleted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete category')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${category.color}1f`, color: category.color }}
        >
          <CategoryIcon name={category.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{category.name}</p>
            {pct >= 100 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                <TriangleAlert className="h-3 w-3" /> Over
              </span>
            )}
            {category.expenseCount === 0 && !category.isDefault && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="ml-auto text-gray-300 transition-colors hover:text-rose-500"
                      onClick={() => void handleDelete()}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete category</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {category.expenseCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-auto text-gray-300" aria-disabled="true">
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Has {category.expenseCount} expense(s) — move or delete them first
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={Math.min(100, pct)} className="h-2 flex-1" indicatorClassName={barColor} aria-label={`${category.name} budget usage`} />
            <span className="w-12 text-right text-xs tabular-nums text-gray-500">{pct}%</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {formatCurrency(category.monthTotal)} spent in {formatMonthKey(month)}
            {budget > 0 ? ` of ${formatCurrency(budget)} · ${formatCurrency(Math.max(0, budget - category.monthTotal))} left` : ' · no budget set'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:w-52">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <Input
            type="number"
            min="0"
            step="10"
            placeholder="No limit"
            className="pl-7"
            value={budgetInput}
            aria-label={`${category.name} monthly budget`}
            onChange={(e) => {
              setBudgetInput(e.target.value)
              setDirty(true)
            }}
          />
        </div>
        {dirty && (
          <Button size="sm" onClick={() => void saveBudget()} disabled={updateMutation.isPending} className="shrink-0">
            <Check className="h-4 w-4" /> Save
          </Button>
        )}
      </div>
    </div>
  )
}

export function BudgetsView() {
  const month = toISODate(new Date()).slice(0, 7)
  const { data, isLoading } = useCategories(month)
  const [addOpen, setAddOpen] = useState(false)

  const categories = useMemo(() => data?.categories ?? [], [data])
  const totalBudget = categories.reduce((s, c) => s + (c.budget ?? 0), 0)
  const totalSpent = categories.reduce((s, c) => s + c.monthTotal, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-5">
      <SectionCard
        title="Monthly budget overview"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      >
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <PiggyBank className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(totalSpent)}</p>
                  <p className="text-sm text-gray-500">
                    spent of {totalBudget > 0 ? formatCurrency(totalBudget) : 'no total budget'} budgeted ·{' '}
                    {formatMonthKey(month)}
                  </p>
                </div>
                {totalBudget > 0 && (
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      overallPct >= 100 ? 'text-rose-600' : overallPct >= 75 ? 'text-amber-600' : 'text-emerald-700'
                    }`}
                  >
                    {overallPct}% used
                  </span>
                )}
              </div>
              {totalBudget > 0 && (
                <Progress
                  value={Math.min(100, overallPct)}
                  className="mt-3 h-2.5"
                  indicatorClassName={overallPct >= 100 ? 'bg-rose-500' : overallPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}
                  aria-label={`Total budget usage ${overallPct}%`}
                />
              )}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Budgets are monthly limits per category and reset on the 1st of each month. Type an amount and press Save to
          set or change a limit.
        </p>
      </SectionCard>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => (
            <BudgetRow key={c.id} category={c} month={month} />
          ))}
        </div>
      )}

      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}

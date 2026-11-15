'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCategories, useCreateExpense, useExpenses, useUpdateExpense } from './hooks'
import {
  ExpenseFormFields,
  ReceiptPreview,
  ItemsList,
  validateForm,
  toPayload,
  type ExpenseFormValue,
} from './expense-form'
import { toISODate } from '@/lib/period'
import { formatCurrency } from '@/lib/format'
import type { ExpenseDTO, ExpenseItem } from '@/lib/types'

export interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  expense?: ExpenseDTO | null
  onSaved?: () => void
}

function emptyDraft(): ExpenseFormValue {
  return { amount: '', merchant: '', date: toISODate(new Date()), categoryId: '', description: '' }
}

export function ExpenseDialog({ open, onOpenChange, mode, expense, onSaved }: ExpenseDialogProps) {
  const [value, setValue] = useState<ExpenseFormValue>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lastOpen, setLastOpen] = useState(false)
  const { data: catData } = useCategories()
  const { data: merchantData } = useExpenses({ limit: 400 }, open)
  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()

  const categories = catData?.categories ?? []
  const merchants = useMemo(() => {
    const set = new Set<string>()
    for (const e of merchantData?.expenses ?? []) {
      if (e.merchant) set.add(e.merchant)
      if (set.size >= 100) break
    }
    return [...set]
  }, [merchantData])

  // Reset form state when the dialog opens (render-time adjustment, no effect needed)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setErrors({})
      if (mode === 'edit' && expense) {
        setValue({
          amount: String(expense.amount),
          merchant: expense.merchant,
          date: expense.date,
          categoryId: expense.categoryId,
          description: expense.description || '',
        })
      } else {
        setValue(emptyDraft())
      }
    }
  }

  const items: ExpenseItem[] | null = useMemo(() => {
    if (!expense?.items) return null
    try {
      return JSON.parse(expense.items) as ExpenseItem[]
    } catch {
      return null
    }
  }, [expense])

  const pending = createMutation.isPending || updateMutation.isPending

  async function handleSave() {
    const errs = validateForm(value)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    try {
      if (mode === 'edit' && expense) {
        await updateMutation.mutateAsync({ id: expense.id, payload: toPayload(value, { items: expense.items, receiptImage: expense.receiptImage, source: expense.source }) })
        toast.success('Expense updated')
      } else {
        await createMutation.mutateAsync(toPayload(value))
        toast.success(`Expense added — ${formatCurrency(Number(value.amount))}`)
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? (
              <>
                <Pencil className="h-4 w-4 text-emerald-600" /> Edit expense
              </>
            ) : (
              'Add expense'
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update the details of this expense.'
              : 'Log a payment you made. You can also scan a receipt instead.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
          {items && items.length > 0 && <ItemsList items={items} />}
          {expense?.receiptImage && <ReceiptPreview image={expense.receiptImage} />}
          <ExpenseFormFields value={value} onChange={setValue} categories={categories} errors={errors} merchants={merchants} disabled={pending} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending} className="min-w-28">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'edit' ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionCard, StatCard } from './ui-bits'
import { useAnalytics, useCreateIncome, useDeleteIncome, useIncome } from './hooks'
import { currencySymbol, formatCurrency } from '@/lib/format'
import { getPeriodRange, toISODate, type PeriodKey } from '@/lib/period'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
]

const SOURCE_SUGGESTIONS = ['Salary', 'Freelance', 'Business', 'Investments', 'Rental', 'Gift', 'Refund', 'Other']

export function IncomeView() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const today = toISODate(new Date())
  const range = getPeriodRange(period, today)
  const { data, isLoading } = useIncome(range.start, range.end)
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(period)
  const createIncome = useCreateIncome()
  const deleteIncome = useDeleteIncome()

  const [form, setForm] = useState({ amount: '', source: 'Salary', date: today, description: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }
    try {
      await createIncome.mutateAsync({
        amount,
        source: form.source.trim() || 'Other',
        date: form.date,
        description: form.description.trim() || null,
      })
      toast.success(`Added ${formatCurrency(amount)} income`)
      setForm((f) => ({ ...f, amount: '', description: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add income')
    }
  }

  const summary = analytics?.summary
  const net = summary?.net ?? 0
  const sym = currencySymbol()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              period === p.key ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Income" value={formatCurrency(summary?.income ?? 0)} icon={Banknote} iconBg="bg-sky-50 text-sky-600" loading={analyticsLoading} />
        <StatCard label="Spent" value={formatCurrency(summary?.total ?? 0)} icon={Wallet} loading={analyticsLoading} />
        <StatCard
          label={!summary?.income || net >= 0 ? 'Net savings' : 'Overspent'}
          value={summary?.income ? formatCurrency(Math.abs(net)) : '—'}
          icon={PiggyBank}
          iconBg={!summary?.income || net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}
          loading={analyticsLoading}
          sub={summary?.income ? `${Math.round((net / summary.income) * 100)}% of income` : 'add income to see savings'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <SectionCard title="Add income">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{sym}</span>
                <Input
                  id="inc-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={sym.length > 1 ? 'pl-11' : 'pl-7'}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-source">Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                <SelectTrigger id="inc-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_SUGGESTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-date">Date</Label>
              <Input id="inc-date" type="date" value={form.date} max={today} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-note">Note (optional)</Label>
              <Input id="inc-note" value={form.description} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" disabled={createIncome.isPending}>
              <Plus className="h-4 w-4" /> {createIncome.isPending ? 'Adding…' : 'Add income'}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Income entries" action={<span className="text-sm font-semibold tabular-nums">{formatCurrency(data?.total ?? 0)}</span>}>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : (data?.income.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-10 text-center">
              <Banknote className="h-9 w-9 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No income recorded for this period</p>
              <p className="max-w-xs text-xs text-gray-400">Add your salary or other income to see how much you are saving.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data?.income.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Banknote className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.source}</p>
                    <p className="truncate text-xs text-gray-400">
                      {i.date}
                      {i.description ? ` · ${i.description}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-sky-700">+{formatCurrency(i.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-rose-600"
                    aria-label={`Delete ${i.source} income`}
                    disabled={deleteIncome.isPending}
                    onClick={async () => {
                      try {
                        await deleteIncome.mutateAsync(i.id)
                        toast.success('Income entry deleted')
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
        </SectionCard>
      </div>
    </div>
  )
}

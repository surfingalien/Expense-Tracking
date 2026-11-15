'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Database,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useCategories, useDemoMutation, useDemoStatus, useExpenses, useMonthlySummary } from './hooks'
import { SectionCard } from './ui-bits'
import { formatCurrency } from '@/lib/format'
import { formatMonthKey, getPeriodRange, getPrevPeriodRange, toISODate } from '@/lib/period'

type ReportPeriod = 'week' | 'month' | 'lastMonth' | '30d' | 'year' | 'all'

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'week', label: 'This week' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

function rangeForReport(key: ReportPeriod): { start: string; end: string; label: string } {
  const today = toISODate(new Date())
  if (key === 'all') return { start: '2000-01-01', end: today, label: 'All time' }
  if (key === 'lastMonth') {
    const prev = getPrevPeriodRange('month', today)
    return { start: prev.start, end: prev.end, label: 'Last month' }
  }
  const { start, end } = getPeriodRange(key, today)
  const label = PERIODS.find((p) => p.key === key)?.label || 'Custom'
  return { start, end, label }
}

export function ReportsView() {
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [confirmAction, setConfirmAction] = useState<'load' | 'clear' | null>(null)

  const { data: demoStatus, isLoading: statusLoading } = useDemoStatus()
  const { data: catData } = useCategories()
  const demoMutation = useDemoMutation()

  const range = useMemo(() => rangeForReport(period), [period])
  const monthly = useMonthlySummary(6, range.end)

  // summary for the selected period (cached by react-query)
  const summaryQuery = useExpenses({ start: range.start, end: range.end, limit: 2000 }, true)

  const summary = summaryQuery.data?.summary
  const categories = catData?.categories ?? []

  function download(kind: 'pdf' | 'csv') {
    const params = new URLSearchParams({ start: range.start, end: range.end, label: range.label })
    const url = kind === 'pdf' ? `/api/reports/pdf?${params}` : `/api/reports/csv?${params}`
    window.location.href = url
    toast.success(kind === 'pdf' ? 'PDF report downloading…' : 'CSV export downloading…')
  }

  async function runDemoAction(action: 'load' | 'clear') {
    try {
      const res = await demoMutation.mutateAsync(action)
      if (action === 'load') {
        toast.success(`Demo data loaded (${res.seeded ?? 0} expenses)`)
      } else {
        toast.success(`Removed ${res.removed ?? 0} expenses`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setConfirmAction(null)
    }
  }

  const months = monthly.data?.months ?? []

  return (
    <div className="space-y-5">
      <SectionCard
        title="Generate report"
        action={
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-[160px]" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <p className="text-sm text-gray-500">
          Period: <span className="font-semibold text-gray-900">{range.label}</span> ({range.start} → {range.end})
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Total spent</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
              {summaryQuery.isLoading ? '…' : formatCurrency(summary?.total ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Transactions</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
              {summaryQuery.isLoading ? '…' : String(summary?.count ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Categories used</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{categories.length}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => download('pdf')} disabled={summaryQuery.isLoading} className="min-w-44">
            <FileText className="h-4 w-4" /> Download PDF report
          </Button>
          <Button variant="outline" onClick={() => download('csv')} disabled={summaryQuery.isLoading} className="min-w-44">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Download CSV export
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          The PDF includes a summary, category breakdown, budget performance, trend chart, monthly summary and the full
          transaction list. The CSV contains one row per expense, ready for Excel or Google Sheets.
        </p>
      </SectionCard>

      <SectionCard
        title="Monthly summary"
        action={<span className="text-xs text-gray-400">last 6 months</span>}
      >
        {monthly.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : months.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4 font-semibold">Month</th>
                  <th className="py-2 pr-4 text-right font-semibold">Total</th>
                  <th className="py-2 pr-4 text-right font-semibold">Txns</th>
                  <th className="py-2 text-right font-semibold">vs previous</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{formatMonthKey(m.month, true)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-gray-900">
                      {formatCurrency(m.total)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-600">{m.count}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {m.deltaPct == null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className={m.deltaPct >= 0 ? 'font-medium text-rose-600' : 'font-medium text-emerald-700'}>
                          {m.deltaPct >= 0 ? '+' : ''}
                          {Math.round(m.deltaPct)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Data management" action={<Database className="h-4 w-4 text-gray-300" />}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <span>
            <strong className="text-gray-900">{statusLoading ? '…' : demoStatus?.expenses ?? 0}</strong> expenses stored
          </span>
          <span>
            <strong className="text-gray-900">{statusLoading ? '…' : demoStatus?.categories ?? 0}</strong> categories
          </span>
          <span>
            <strong className="text-gray-900">{statusLoading ? '…' : demoStatus?.demoExpenses ?? 0}</strong> demo expenses
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setConfirmAction('load')} disabled={demoMutation.isPending}>
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <RefreshCcw className="hidden" /> Load demo data
          </Button>
          <Button
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => setConfirmAction('clear')}
            disabled={demoMutation.isPending}
          >
            <Trash2 className="h-4 w-4" /> Clear all expenses
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Loading demo data replaces the sample expenses with a fresh 90-day dataset (categories and your own expenses
          are kept). Clearing removes every expense but keeps your categories and budgets.
        </p>
      </SectionCard>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === 'load' ? 'Reload demo data?' : 'Clear all expenses?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'load'
                ? 'This replaces the current demo expenses with a fresh 90-day sample dataset. Your categories, budgets and manually added expenses are kept.'
                : 'Every expense will be permanently removed. Categories and budgets are kept. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction === 'clear' ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
              onClick={(e) => {
                e.preventDefault()
                void runDemoAction(confirmAction === 'load' ? 'load' : 'clear')
              }}
            >
              {confirmAction === 'load' ? 'Load demo data' : 'Clear everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

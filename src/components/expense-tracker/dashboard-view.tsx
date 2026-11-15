'use client'

import { useState } from 'react'
import { CalendarDays, Coins, Landmark, ReceiptText, Sparkles, Wallet } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAnalytics, useDemoStatus } from './hooks'
import { StatCard, SectionCard } from './ui-bits'
import { BudgetBars, CategoryDonut, TrendChart } from './charts'
import { CategoryIcon } from './category-icon'
import { formatCurrency, formatPct } from '@/lib/format'
import { friendlyDayLabel, formatMonthKey, toISODate, type PeriodKey } from '@/lib/period'
import type { ExpenseDTO } from '@/lib/types'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'year', label: 'This Year' },
]

function periodSubLabel(period: PeriodKey): string {
  const map: Record<PeriodKey, string> = {
    today: 'today',
    week: 'this week',
    month: 'since the 1st',
    '30d': 'last 30 days',
    year: 'since January',
  }
  return map[period]
}

function RecentRow({ expense, today }: { expense: ExpenseDTO; today: string }) {
  const c = expense.category
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${c.color}1f`, color: c.color }}
      >
        <CategoryIcon name={c.icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{expense.merchant}</p>
        <p className="truncate text-xs text-gray-500">
          {c.name} · {friendlyDayLabel(expense.date, today)}
          {expense.source === 'scan' ? ' · Scanned' : ''}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
        {formatCurrency(expense.amount)}
      </span>
    </div>
  )
}

export function DashboardView({ onGoToExpenses }: { onGoToExpenses: () => void }) {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const { data, isLoading, isError, error } = useAnalytics(period, 6)
  const { data: demoStatus } = useDemoStatus()
  const today = toISODate(new Date())

  const summary = data?.summary
  const trend = data?.trend ?? []
  const donutSlices = data?.categories ?? []
  const budgets = data?.budgets ?? []
  const merchants = data?.merchants ?? []
  const recent = data?.recent ?? []
  const hasDemo = (demoStatus?.demoExpenses ?? 0) > 0

  return (
    <div className="space-y-5">
      {hasDemo && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
          <Sparkles className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            Demo data is loaded so you can explore the app. Add your own expenses anytime, or manage demo data in the
            <strong> Reports</strong> view.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              period === p.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
            aria-pressed={period === p.key}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load analytics: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Spent"
          value={summary ? formatCurrency(summary.total) : '$0.00'}
          icon={Wallet}
          loading={isLoading}
          deltaPct={summary?.deltaPct ?? null}
          invertDelta
          sub={summary?.prevTotal ? `vs ${formatCurrency(summary.prevTotal)} before` : periodSubLabel(period)}
        />
        <StatCard
          label="Transactions"
          value={summary ? String(summary.count) : '0'}
          icon={ReceiptText}
          loading={isLoading}
          iconBg="bg-amber-50 text-amber-600"
          sub={`${periodSubLabel(period)}`}
        />
        <StatCard
          label="Avg / Day"
          value={summary ? formatCurrency(summary.avgPerDay) : '$0.00'}
          icon={CalendarDays}
          loading={isLoading}
          iconBg="bg-teal-50 text-teal-600"
          sub={`${summary?.days ?? 0} day(s) in period`}
        />
        <StatCard
          label="Top Category"
          value={summary?.topCategory?.name ?? '—'}
          icon={Landmark}
          loading={isLoading}
          iconBg="bg-rose-50 text-rose-500"
          sub={summary?.topCategory ? formatCurrency(summary.topCategory.total) : 'no spending yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Spending Trend" className="lg:col-span-2" action={<span className="text-xs text-gray-400">{PERIODS.find((p) => p.key === period)?.label}</span>}>
          <TrendChart buckets={trend} loading={isLoading} />
        </SectionCard>

        <SectionCard title="By Category">
          <CategoryDonut slices={donutSlices} total={summary?.total ?? 0} loading={isLoading} />
          {!isLoading && donutSlices.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {donutSlices.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 truncate text-gray-600">{s.name}</span>
                  <span className="tabular-nums font-medium text-gray-900">{formatCurrency(s.total)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-gray-400">{formatPct(s.pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Monthly Budgets"
          action={<span className="text-xs text-gray-400">{formatMonthKey(today.slice(0, 7))}</span>}
        >
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              No budgets set yet.
              <div className="mt-2 text-xs text-gray-400">Set monthly limits per category in the Budgets view.</div>
            </div>
          ) : (
            <ul className="space-y-3">
              {budgets.slice(0, 5).map((b) => (
                <li key={b.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-gray-700">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${b.color}1f`, color: b.color }}>
                        <CategoryIcon name={b.icon} className="h-3.5 w-3.5" />
                      </span>
                      {b.name}
                    </span>
                    <span className="tabular-nums text-gray-500">
                      <span className={b.over ? 'font-semibold text-rose-600' : 'font-semibold text-gray-900'}>
                        {formatCurrency(b.spent)}
                      </span>{' '}
                      / {formatCurrency(b.budget)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, b.pct)} className="h-2" aria-label={`${b.name} budget usage ${b.pct}%`} />
                  {b.over && (
                    <p className="text-xs font-medium text-rose-600">
                      Over budget by {formatCurrency(b.spent - b.budget)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Top Merchants">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : merchants.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No merchants in this period yet.</div>
          ) : (
            <ul className="space-y-3">
              {merchants.map((m, i) => (
                <li key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-gray-700">{m.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">({m.count})</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-gray-900">{formatCurrency(m.total)}</span>
                  </div>
                  <Progress value={m.pct} className="h-1.5" aria-label={`${m.name} share ${m.pct}%`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent Transactions"
        action={
          <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800" onClick={onGoToExpenses}>
            View all
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Coins className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">No expenses yet — add your first one or scan a receipt.</p>
          </div>
        ) : (
          <div className="max-h-[320px] divide-y divide-gray-50 overflow-y-auto pr-1">
            {recent.map((e) => (
              <RecentRow key={e.id} expense={e} today={today} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAnalytics } from './hooks'
import { formatCurrency } from '@/lib/format'
import { currentMonthKey, toISODate } from '@/lib/period'

const WARN_AT = 80

function dismissKey() {
  return `budget-alerts-dismissed:${currentMonthKey(toISODate(new Date()))}`
}

/**
 * Banner listing categories at or above 80% of this month's budget.
 * Dismissing hides it until the set of alerting categories changes or a
 * new month starts.
 */
export function BudgetAlerts({ onOpenBudgets }: { onOpenBudgets: () => void }) {
  const { data } = useAnalytics('month')
  const alerts = (data?.budgets ?? []).filter((b) => b.pct >= WARN_AT)
  const signature = alerts.map((b) => `${b.categoryId}:${b.over ? 'over' : 'warn'}`).join(',')
  const [dismissed, setDismissed] = useState(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem(dismissKey()) || '',
  )

  if (alerts.length === 0 || dismissed === signature) return null

  const over = alerts.filter((b) => b.over)
  const tone = over.length ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <div role="status" className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {over.length
            ? `${over.length} ${over.length === 1 ? 'budget' : 'budgets'} exceeded this month`
            : `${alerts.length} ${alerts.length === 1 ? 'budget is' : 'budgets are'} nearly used up`}
        </p>
        <ul className="mt-1 space-y-0.5">
          {alerts.slice(0, 4).map((b) => (
            <li key={b.categoryId}>
              {b.name}: {formatCurrency(b.spent)} of {formatCurrency(b.budget)} ({b.pct}%)
            </li>
          ))}
        </ul>
        <button className="mt-1.5 font-semibold underline underline-offset-2" onClick={onOpenBudgets}>
          Review budgets
        </button>
      </div>
      <button
        aria-label="Dismiss budget alerts"
        className="rounded-md p-1 opacity-70 hover:opacity-100"
        onClick={() => {
          window.localStorage.setItem(dismissKey(), signature)
          setDismissed(signature)
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

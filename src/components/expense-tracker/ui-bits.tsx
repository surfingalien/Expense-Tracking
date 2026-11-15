'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  deltaPct,
  invertDelta = false,
  iconBg = 'bg-emerald-50 text-emerald-600',
  loading = false,
}: {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  deltaPct?: number | null
  invertDelta?: boolean
  iconBg?: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    )
  }

  const deltaGood = invertDelta ? (deltaPct ?? 0) < 0 : (deltaPct ?? 0) > 0
  const showDelta = deltaPct != null && Number.isFinite(deltaPct)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
        </div>
        <div
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${iconBg}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {showDelta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
              deltaGood ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(deltaPct))}%
          </span>
        )}
        {sub && <span className="truncate text-gray-500">{sub}</span>}
      </div>
    </div>
  )
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Money({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatCurrency(value)}</span>
}

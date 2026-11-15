'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/format'
import type { BudgetProgress, CategorySlice, TrendBucket } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'

const EMERALD = '#10b981'
const EMERALD_DARK = '#047857'

interface ChartTooltipProps {
  active?: boolean
  payload?: { value?: number | string; payload?: { label?: string; name?: string; fill?: string } }[]
  label?: string
}

function TrendTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const name = p.payload?.label || label || ''
  const value = typeof p.value === 'number' ? p.value : 0
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-500">{name}</p>
      <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(value)}</p>
    </div>
  )
}

export function TrendChart({ buckets, loading }: { buckets: TrendBucket[]; loading?: boolean }) {
  if (loading) return <Skeleton className="h-[280px] w-full rounded-xl" />
  if (!buckets.length) return null

  const useBars = buckets.length <= 14
  const tickInterval = Math.max(0, Math.ceil(buckets.length / 16) - 1)
  const height = 280

  return (
    <div style={{ width: '100%', height }} className="text-xs">
      <ResponsiveContainer width="100%" height="100%">
        {useBars ? (
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EMERALD} stopOpacity={1} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ef" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
            <Bar dataKey="amount" fill="url(#barGrad)" radius={[5, 5, 0, 0]} maxBarSize={42} />
          </BarChart>
        ) : (
          <AreaChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EMERALD} stopOpacity={0.32} />
                <stop offset="100%" stopColor={EMERALD} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ef" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke={EMERALD}
              strokeWidth={2.5}
              fill="url(#areaGrad)"
              dot={false}
              activeDot={{ r: 4, fill: EMERALD_DARK, strokeWidth: 0 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryDonut({ slices, total, loading }: { slices: CategorySlice[]; total: number; loading?: boolean }) {
  if (loading) return <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
  if (!slices.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
        No spending in this period
      </div>
    )
  }

  const top = slices.slice(0, 7)
  const rest = slices.slice(7)
  const data = rest.length
    ? [
        ...top,
        {
          id: 'others',
          name: `Others (${rest.length})`,
          color: '#cbd5e1',
          total: rest.reduce((s, r) => s + r.total, 0),
          count: rest.reduce((s, r) => s + r.count, 0),
          pct: rest.reduce((s, r) => s + r.pct, 0),
        },
      ]
    : top

  return (
    <div className="relative">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius={66}
              outerRadius={92}
              paddingAngle={2}
              strokeWidth={2}
              stroke="#ffffff"
            >
              {data.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | string, name: string) => [formatCurrency(Number(value)), name]}
              contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Total</span>
        <span className="text-xl font-bold tabular-nums text-gray-900">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function budgetColor(pct: number): string {
  if (pct >= 100) return '#ef4444'
  if (pct >= 75) return '#f59e0b'
  return EMERALD
}

export function BudgetBars({ budgets, loading }: { budgets: BudgetProgress[]; loading?: boolean }) {
  if (loading) return <Skeleton className="h-[180px] w-full rounded-xl" />
  if (!budgets.length) return null

  const data = budgets.map((b) => ({
    name: b.name.length > 14 ? `${b.name.slice(0, 13)}…` : b.name,
    spent: b.spent,
    budget: b.budget,
    fill: budgetColor(b.pct),
  }))

  const height = Math.max(180, data.length * 44 + 40)
  return (
    <div style={{ width: '100%', height }} className="text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ef" />
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => [formatCurrency(Number(value)), name === 'spent' ? 'Spent' : 'Budget']}
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
            cursor={{ fill: 'rgba(16,185,129,0.05)' }}
          />
          <Bar dataKey="spent" radius={[0, 5, 5, 0]} maxBarSize={16} background={{ fill: '#f1f3f2', radius: 5 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

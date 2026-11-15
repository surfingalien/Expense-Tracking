'use client'

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  currentMonthKey,
  getPeriodRange,
  getPrevPeriodRange,
  toISODate,
  type Granularity,
  type PeriodKey,
} from '@/lib/period'
import { formatCurrency } from '@/lib/format'
import type {
  AnalyticsResponse,
  BudgetStatus,
  CategoryWithStats,
  DemoStatus,
  ExpenseMutationResponse,
  ExpensesResponse,
  MonthSummary,
} from '@/lib/types'

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // ignore parse failure
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export interface ExpenseFilters {
  start?: string
  end?: string
  categoryId?: string
  q?: string
  sort?: string
  limit?: number
}

export function useExpenses(filters: ExpenseFilters, enabled = true) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ today: toISODate(new Date()) })
      if (filters.start) params.set('start', filters.start)
      if (filters.end) params.set('end', filters.end)
      if (filters.categoryId && filters.categoryId !== 'all') params.set('categoryId', filters.categoryId)
      if (filters.q) params.set('q', filters.q)
      if (filters.sort) params.set('sort', filters.sort)
      if (filters.limit) params.set('limit', String(filters.limit))
      return fetchJSON<ExpensesResponse>(`/api/expenses?${params.toString()}`)
    },
    enabled,
  })
}

export function useCategories(month?: string) {
  return useQuery({
    queryKey: ['categories', month ?? 'none'],
    queryFn: () => {
      const params = new URLSearchParams({ today: toISODate(new Date()) })
      if (month) params.set('month', month)
      return fetchJSON<{ categories: CategoryWithStats[] }>(`/api/categories?${params.toString()}`)
    },
  })
}

export function useAnalytics(period: PeriodKey, monthly?: number) {
  return useQuery({
    queryKey: ['analytics', period, monthly ?? 0],
    queryFn: () => {
      const today = toISODate(new Date())
      const { start, end } = getPeriodRange(period, today)
      const prev = getPrevPeriodRange(period, today)
      const granularity: Granularity = period === 'year' ? 'month' : 'day'
      const params = new URLSearchParams({
        start,
        end,
        prevStart: prev.start,
        prevEnd: prev.end,
        granularity,
        month: currentMonthKey(today),
        today,
      })
      if (monthly) params.set('monthly', String(monthly))
      return fetchJSON<AnalyticsResponse>(`/api/analytics?${params.toString()}`)
    },
  })
}

export function useMonthlySummary(months = 6, end?: string) {
  return useQuery({
    queryKey: ['monthly', months, end ?? 'now'],
    queryFn: () => {
      const params = new URLSearchParams({ months: String(months), today: toISODate(new Date()) })
      if (end) params.set('end', end)
      return fetchJSON<{ months: MonthSummary[] }>(`/api/reports/monthly?${params.toString()}`)
    },
  })
}

export function useDemoStatus() {
  return useQuery({
    queryKey: ['demo-status'],
    queryFn: () => fetchJSON<DemoStatus>('/api/demo'),
  })
}

function invalidateAll(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['expenses'] })
  void qc.invalidateQueries({ queryKey: ['analytics'] })
  void qc.invalidateQueries({ queryKey: ['categories'] })
  void qc.invalidateQueries({ queryKey: ['monthly'] })
  void qc.invalidateQueries({ queryKey: ['demo-status'] })
}

export function notifyBudgetStatus(status: BudgetStatus | null | undefined) {
  if (!status || status.budget == null) return
  const pct = Math.round((status.monthTotal / status.budget) * 100)
  if (status.monthTotal > status.budget) {
    toast.warning('Budget exceeded', {
      description: `${status.categoryName}: ${formatCurrency(status.monthTotal)} of ${formatCurrency(
        status.budget,
      )} monthly budget used (${pct}%)`,
    })
  } else if (pct >= 80) {
    toast('Approaching budget limit', {
      description: `${status.categoryName}: ${pct}% of the monthly budget is used`,
    })
  }
}

export interface ExpensePayload {
  amount: number
  merchant: string
  date: string
  categoryId: string
  description?: string | null
  items?: string | null
  receiptImage?: string | null
  source?: string
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExpensePayload) =>
      fetchJSON<ExpenseMutationResponse>('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      invalidateAll(qc)
      notifyBudgetStatus(data.budgetStatus)
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      fetchJSON<ExpenseMutationResponse>(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ ok: boolean }>(`/api/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  })
}

export interface CategoryPayload {
  name?: string
  color?: string
  icon?: string
  budget?: number | null
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CategoryPayload) =>
      fetchJSON<{ category: { id: string } }>('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryPayload }) =>
      fetchJSON<{ category: { id: string } }>(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJSON<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDemoMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: 'load' | 'clear') =>
      fetchJSON<{ ok: boolean; seeded?: number; removed?: number }>('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, today: toISODate(new Date()) }),
      }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: (image: string) =>
      fetchJSON('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      }),
  })
}

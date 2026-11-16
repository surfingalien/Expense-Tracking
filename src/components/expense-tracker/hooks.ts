'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
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
  ImportRowResult,
  IncomeDTO,
  MonthSummary,
  RecurringDTO,
  RecurringFrequency,
  ScanResult,
  UserSettingsDTO,
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

function expenseParams(filters: ExpenseFilters, offset = 0) {
  const params = new URLSearchParams({ today: toISODate(new Date()) })
  if (filters.start) params.set('start', filters.start)
  if (filters.end) params.set('end', filters.end)
  if (filters.categoryId && filters.categoryId !== 'all') params.set('categoryId', filters.categoryId)
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (offset) params.set('offset', String(offset))
  return params
}

export function useExpenses(filters: ExpenseFilters, enabled = true) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => fetchJSON<ExpensesResponse>(`/api/expenses?${expenseParams(filters)}`),
    enabled,
  })
}

/** Paginated expense list: loads 50 rows at a time ("Load more"). */
export function useInfiniteExpenses(filters: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: ['expenses', 'infinite', filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchJSON<ExpensesResponse>(`/api/expenses?${expenseParams({ ...filters, limit: 50 }, pageParam)}`),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
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

export function invalidateAll(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['expenses'] })
  void qc.invalidateQueries({ queryKey: ['analytics'] })
  void qc.invalidateQueries({ queryKey: ['categories'] })
  void qc.invalidateQueries({ queryKey: ['monthly'] })
  void qc.invalidateQueries({ queryKey: ['demo-status'] })
  void qc.invalidateQueries({ queryKey: ['income'] })
  void qc.invalidateQueries({ queryKey: ['recurring'] })
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
      fetchJSON<ScanResult>('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, today: toISODate(new Date()) }),
      }),
  })
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// ---- settings ----
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchJSON<UserSettingsDTO>(`/api/settings?today=${toISODate(new Date())}`),
    staleTime: Infinity,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserSettingsDTO) => fetchJSON<UserSettingsDTO>('/api/settings', jsonInit('PUT', payload)),
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  })
}

// ---- income ----
export interface IncomePayload {
  amount: number
  source: string
  date: string
  description?: string | null
}

export function useIncome(start: string, end: string) {
  return useQuery({
    queryKey: ['income', start, end],
    queryFn: () => fetchJSON<{ income: IncomeDTO[]; total: number }>(`/api/income?start=${start}&end=${end}`),
  })
}

export function useCreateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IncomePayload) => fetchJSON<{ income: IncomeDTO }>('/api/income', jsonInit('POST', payload)),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJSON<{ ok: boolean }>(`/api/income/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  })
}

// ---- recurring expenses ----
export interface RecurringPayload {
  amount: number
  merchant: string
  categoryId: string
  frequency: RecurringFrequency
  startDate: string
  description?: string | null
  active?: boolean
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => fetchJSON<{ recurring: RecurringDTO[] }>(`/api/recurring?today=${toISODate(new Date())}`),
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecurringPayload) =>
      fetchJSON<{ recurring: RecurringDTO; created: number }>(
        '/api/recurring',
        jsonInit('POST', { ...payload, today: toISODate(new Date()) }),
      ),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RecurringPayload> }) =>
      fetchJSON<{ recurring: RecurringDTO }>(`/api/recurring/${id}`, jsonInit('PUT', payload)),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJSON<{ ok: boolean }>(`/api/recurring/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  })
}

// ---- CSV import ----
export interface ImportRow {
  date: string
  merchant: string
  amount: number
  category?: string | null
  description?: string | null
}

export function useImportExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: ImportRow[]) => fetchJSON<ImportRowResult>('/api/import', jsonInit('POST', { rows })),
    onSuccess: () => invalidateAll(qc),
  })
}

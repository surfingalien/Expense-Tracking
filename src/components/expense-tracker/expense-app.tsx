'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  Banknote,
  FileBarChart,
  LayoutDashboard,
  PieChart,
  Plus,
  ReceiptText,
  ScanLine,
  Wallet,
} from 'lucide-react'
import { ExpenseDialog } from './expense-dialog'
import { ScanDialog } from './scan-dialog'
import { DashboardView } from './dashboard-view'
import { ExpensesView } from './expenses-view'
import { BudgetsView } from './budgets-view'
import { ReportsView } from './reports-view'
import { IncomeView } from './income-view'
import { AccountButton } from './account-button'
import { BudgetAlerts } from './budget-alerts'
import { useAnalytics, useSettings } from './hooks'
import { formatCurrency, setActiveCurrency } from '@/lib/format'
import { formatMonthKey, toISODate } from '@/lib/period'
import type { ExpenseDTO } from '@/lib/types'

type View = 'dashboard' | 'expenses' | 'income' | 'budgets' | 'reports'

const NAV: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'expenses', label: 'Expenses', icon: ReceiptText },
  { key: 'income', label: 'Income', icon: Banknote },
  { key: 'budgets', label: 'Budgets', icon: PieChart },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
]

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Your spending at a glance' },
  expenses: { title: 'Expenses', subtitle: 'Browse, search and manage every expense' },
  income: { title: 'Income', subtitle: 'Money in, and what you saved' },
  budgets: { title: 'Budgets', subtitle: 'Monthly limits and recurring expenses' },
  reports: { title: 'Reports', subtitle: 'Reports, import, settings and data' },
}

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f7f6]">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6 p-6">
        <div className="h-14 w-full rounded-2xl bg-white" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-white" />
        <div className="h-64 rounded-2xl bg-white" />
      </div>
    </div>
  )
}

const emptySubscribe = () => () => {}

export function ExpenseApp() {
  // Returns false during SSR/prerender, true after hydration — no effect needed.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const [view, setView] = useState<View>('dashboard')
  const [expenseDialog, setExpenseDialog] = useState<{
    open: boolean
    mode: 'add' | 'edit'
    expense: ExpenseDTO | null
  }>({ open: false, mode: 'add', expense: null })
  const [scanOpen, setScanOpen] = useState(false)

  const { data: settings } = useSettings()
  const currency = settings?.currency ?? 'USD'
  // Formatting helpers read the active currency; set it before rendering.
  setActiveCurrency(currency)

  const { data: monthAnalytics } = useAnalytics('month')
  const monthTotal = monthAnalytics?.summary.total ?? 0
  const monthCount = monthAnalytics?.summary.count ?? 0

  if (!mounted) return <AppSkeleton />

  const openAdd = () => setExpenseDialog({ open: true, mode: 'add', expense: null })
  const openEdit = (expense: ExpenseDTO) => setExpenseDialog({ open: true, mode: 'edit', expense })
  const meta = VIEW_META[view]

  return (
    <div key={currency} className="flex min-h-screen flex-col bg-[#f6f7f6] text-gray-900">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-gray-100 bg-white lg:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
              <Wallet className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">Expense Tracker</p>
              <p className="text-[11px] text-gray-400">AI receipts &amp; analytics</p>
            </div>
          </div>

          <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Main navigation">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mx-3 mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white shadow-sm">
            <p className="text-xs font-medium text-emerald-100">{formatMonthKey(toISODate(new Date()).slice(0, 7), true)}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(monthTotal)}</p>
            <p className="mt-0.5 text-xs text-emerald-100">{monthCount} transactions this month</p>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/85 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2.5 lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
                  <Wallet className="h-4.5 w-4.5 text-white" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-bold leading-tight sm:text-xl">{meta.title}</h1>
                <p className="hidden truncate text-xs text-gray-500 sm:block">{meta.subtitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setScanOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700"
                >
                  <ScanLine className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Scan receipt</span>
                </button>
                <button
                  onClick={openAdd}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add expense</span>
                </button>
                <AccountButton />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {view === 'dashboard' && (
              <>
                <BudgetAlerts onOpenBudgets={() => setView('budgets')} />
                <DashboardView onGoToExpenses={() => setView('expenses')} />
              </>
            )}
            {view === 'expenses' && <ExpensesView onEdit={openEdit} onAdd={openAdd} />}
            {view === 'income' && <IncomeView />}
            {view === 'budgets' && <BudgetsView />}
            {view === 'reports' && <ReportsView />}
          </main>

          <footer className="mt-auto hidden border-t border-gray-100 bg-white px-6 py-4 lg:block">
            <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-gray-400">
              <span>Expense Tracker — scan receipts, track spending, stay on budget.</span>
              <span>{toISODate(new Date())} · {currency}</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="sticky bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Dialogs */}
      <ExpenseDialog
        open={expenseDialog.open}
        mode={expenseDialog.mode}
        expense={expenseDialog.expense}
        onOpenChange={(open) => setExpenseDialog((s) => ({ ...s, open }))}
      />
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  )
}

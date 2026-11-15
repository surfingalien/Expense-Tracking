// Shared types for the expense tracker app

export interface CategoryInfo {
  id: string
  name: string
  icon: string
  color: string
  budget: number | null
  isDefault: boolean
}

export interface CategoryWithStats extends CategoryInfo {
  expenseCount: number
  monthTotal: number
}

export interface ExpenseItem {
  name: string
  price: number
  qty?: number | null
}

export interface ExpenseDTO {
  id: string
  amount: number
  merchant: string
  date: string // YYYY-MM-DD
  description: string | null
  items: string | null
  receiptImage: string | null
  source: string // manual | scan | demo
  isDemo: boolean
  categoryId: string
  category: CategoryInfo
  createdAt: string
}

export interface ExpensesResponse {
  expenses: ExpenseDTO[]
  summary: { count: number; total: number }
}

export interface BudgetStatus {
  categoryId: string
  categoryName: string
  budget: number | null
  monthTotal: number
}

export interface ExpenseMutationResponse {
  expense: ExpenseDTO
  budgetStatus: BudgetStatus | null
}

export interface ScanResult {
  merchant: string
  date: string // YYYY-MM-DD
  total: number | null
  tax: number | null
  items: ExpenseItem[]
  categoryId: string
  categoryName: string
  confidence: 'high' | 'medium' | 'low'
  thumbnail: string | null
}

export interface TrendBucket {
  key: string // YYYY-MM-DD or YYYY-MM
  label: string
  amount: number
}

export interface CategorySlice {
  id: string
  name: string
  color: string
  total: number
  count: number
  pct: number
}

export interface MerchantStat {
  name: string
  total: number
  count: number
  pct: number
}

export interface BudgetProgress {
  categoryId: string
  name: string
  color: string
  icon: string
  budget: number
  spent: number
  pct: number
  over: boolean
}

export interface MonthlyRow {
  month: string // YYYY-MM
  total: number
  count: number
}

export interface AnalyticsResponse {
  summary: {
    total: number
    count: number
    avgPerDay: number
    days: number
    prevTotal: number
    deltaPct: number | null
    topCategory: { name: string; color: string; total: number } | null
  }
  trend: TrendBucket[]
  categories: CategorySlice[]
  merchants: MerchantStat[]
  budgets: BudgetProgress[]
  recent: ExpenseDTO[]
  monthly?: MonthlyRow[]
}

export interface MonthSummary {
  month: string
  total: number
  count: number
  deltaPct: number | null
}

export interface DemoStatus {
  expenses: number
  categories: number
  demoExpenses: number
}

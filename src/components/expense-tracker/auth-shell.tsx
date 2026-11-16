import { Wallet } from 'lucide-react'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f6f7f6] px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
          <Wallet className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight text-gray-900">Expense Tracker</p>
          <p className="text-[11px] text-gray-400">AI receipts &amp; analytics</p>
        </div>
      </div>
      {children}
    </div>
  )
}

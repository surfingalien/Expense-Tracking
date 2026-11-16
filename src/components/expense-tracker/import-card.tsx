'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from './ui-bits'
import { useImportExpenses, type ImportRow } from './hooks'
import { guessColumns, parseCSV, parseDate, parseMoney, type DateOrder } from '@/lib/csv'
import { formatCurrency } from '@/lib/format'

type SignMode = 'negative' | 'all'
const NONE = '-1'

function ColumnSelect({
  label,
  value,
  onChange,
  header,
  optional = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  header: string[]
  optional?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>(none)</SelectItem>}
          {header.map((h, i) => (
            <SelectItem key={i} value={String(i)}>
              {h || `Column ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Import expenses from a bank or spreadsheet CSV export. */
export function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const importMutation = useImportExpenses()
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<string[][]>([])
  const [cols, setCols] = useState({ date: -1, description: -1, amount: -1, debit: -1, credit: -1, category: -1 })
  const [signMode, setSignMode] = useState<SignMode>('negative')
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto')

  const header = table[0] ?? []
  const body = table.slice(1)

  async function onFile(file: File) {
    if (file.size > 5 * 1024 * 1024) return void toast.error('File is too large (max 5MB)')
    const rows = parseCSV(await file.text())
    if (rows.length < 2) return void toast.error('That file has no data rows')
    const g = guessColumns(rows[0])
    const amounts = rows.slice(1, 50).map((r) => parseMoney(r[g.amount] ?? '')).filter((n): n is number => n != null)
    // If most amounts are positive the export lists spending as positive numbers.
    setSignMode(amounts.filter((n) => n < 0).length >= amounts.length / 2 ? 'negative' : 'all')
    setCols(g)
    setTable(rows)
    setFileName(file.name)
  }

  const parsed = useMemo(() => {
    const out: ImportRow[] = []
    let skipped = 0
    for (const r of body) {
      const date = parseDate(r[cols.date] ?? '', dateOrder)
      const merchant = (r[cols.description] ?? '').trim()
      let amount: number | null = null
      if (cols.debit >= 0) {
        const debit = parseMoney(r[cols.debit] ?? '')
        amount = debit != null && debit !== 0 ? Math.abs(debit) : null
      } else {
        const a = parseMoney(r[cols.amount] ?? '')
        if (a != null) amount = signMode === 'negative' ? (a < 0 ? -a : null) : Math.abs(a)
      }
      if (!date || !merchant || !amount) {
        skipped++
        continue
      }
      out.push({ date, merchant, amount, category: cols.category >= 0 ? r[cols.category] || null : null })
    }
    return { rows: out, skipped }
  }, [body, cols, signMode, dateOrder])

  async function runImport() {
    try {
      const res = await importMutation.mutateAsync(parsed.rows)
      toast.success(`Imported ${res.imported} expense${res.imported === 1 ? '' : 's'}`, {
        description: res.skipped ? `${res.skipped} skipped (duplicates or invalid rows)` : undefined,
      })
      setTable([])
      setFileName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const total = parsed.rows.reduce((s, r) => s + r.amount, 0)

  return (
    <SectionCard title="Import from CSV" action={<FileUp className="h-4 w-4 text-gray-300" />}>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
      {table.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-gray-500">
            Upload a CSV export from your bank or a spreadsheet. You can check the columns before anything is saved, and
            rows already in the app (same date, description and amount) are skipped.
          </p>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose CSV file
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{fileName}</span> · {body.length} rows
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ColumnSelect label="Date" value={cols.date} header={header} onChange={(v) => setCols((c) => ({ ...c, date: v }))} />
            <ColumnSelect label="Description" value={cols.description} header={header} onChange={(v) => setCols((c) => ({ ...c, description: v }))} />
            {cols.debit >= 0 ? (
              <ColumnSelect label="Money out (debit)" value={cols.debit} header={header} optional onChange={(v) => setCols((c) => ({ ...c, debit: v }))} />
            ) : (
              <ColumnSelect label="Amount" value={cols.amount} header={header} onChange={(v) => setCols((c) => ({ ...c, amount: v }))} />
            )}
            <ColumnSelect label="Category" value={cols.category} header={header} optional onChange={(v) => setCols((c) => ({ ...c, category: v }))} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cols.debit < 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Which rows are expenses?</Label>
                <Select value={signMode} onValueChange={(v) => setSignMode(v as SignMode)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negative">Negative amounts only (skip deposits)</SelectItem>
                    <SelectItem value="all">Every row</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Date format</Label>
              <Select value={dateOrder} onValueChange={(v) => setDateOrder(v as DateOrder)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detect automatically</SelectItem>
                  <SelectItem value="mdy">Month/Day/Year</SelectItem>
                  <SelectItem value="dmy">Day/Month/Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-1.5 tabular-nums">{r.date}</td>
                    <td className="max-w-[240px] truncate px-3 py-1.5">{r.merchant}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{parsed.rows.length}</span> expenses ready ·{' '}
            {formatCurrency(total)} total
            {parsed.skipped > 0 && ` · ${parsed.skipped} rows will be skipped (deposits or unreadable)`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runImport()} disabled={parsed.rows.length === 0 || importMutation.isPending}>
              {importMutation.isPending ? 'Importing…' : `Import ${parsed.rows.length} expenses`}
            </Button>
            <Button variant="outline" onClick={() => setTable([])} disabled={importMutation.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

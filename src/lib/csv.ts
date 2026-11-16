// Small, dependency-free CSV helpers for importing bank exports.

/** Parses CSV text (comma, semicolon or tab separated, RFC 4180 quoting). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  )
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

export type DateOrder = 'auto' | 'mdy' | 'dmy'

/** Normalizes common bank date formats to YYYY-MM-DD, or null. */
export function parseDate(raw: string, order: DateOrder = 'auto'): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    // auto: DD/MM if the first part can't be a month, otherwise MM/DD
    const dmy = order === 'dmy' || (order === 'auto' && a > 12)
    return dmy ? iso(y, b, a) : iso(y, a, b)
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const d = new Date(t)
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return null
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Parses "1,234.56", "-12.30", "(45.00)", "1.234,56", "$12" etc. */
export function parseMoney(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.includes('-')) negative = true
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot && s.length - lastComma <= 3) {
    // European style: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

export interface ColumnGuess {
  date: number
  description: number
  amount: number
  debit: number
  credit: number
  category: number
}

/** Guesses which columns hold the date, description and amount(s). */
export function guessColumns(header: string[]): ColumnGuess {
  const h = header.map((x) => x.toLowerCase())
  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = h.findIndex((x) => p.test(x))
      if (i !== -1) return i
    }
    return -1
  }
  return {
    date: find(/^date$/, /transaction date|posted|posting date|booking date/, /date/),
    description: find(/^(description|merchant|payee|name)$/, /description|merchant|payee|details|narrative|memo|name/),
    amount: find(/^amount$/, /amount|value/),
    debit: find(/debit|withdrawal|money out|paid out/),
    credit: find(/credit|deposit|money in|paid in/),
    category: find(/category/),
  }
}

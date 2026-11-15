// Client-side formatting helpers

export function formatCurrency(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  }
  return `$${Math.round(n)}`
}

export function formatPct(n: number): string {
  return `${Math.round(n)}%`
}

export function sourceIconLabel(source: string): string {
  if (source === 'scan') return 'Scanned'
  if (source === 'demo') return 'Demo'
  return 'Manual'
}

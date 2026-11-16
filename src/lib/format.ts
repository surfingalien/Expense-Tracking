// Client-side formatting helpers. The active currency comes from the user's
// settings (see useSettings); it is display-only — amounts are not converted.

let activeCurrency = 'USD'

export function setActiveCurrency(code: string) {
  activeCurrency = code || 'USD'
}

export function getActiveCurrency(): string {
  return activeCurrency
}

const formatters = new Map<string, Intl.NumberFormat>()
function formatter(key: string, make: () => Intl.NumberFormat) {
  let f = formatters.get(key)
  if (!f) {
    f = make()
    formatters.set(key, f)
  }
  return f
}

export function formatCurrency(n: number, currency = activeCurrency): string {
  return formatter(`full:${currency}`, () => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency })
    } catch {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
    }
  }).format(n)
}

export function formatCompact(n: number, currency = activeCurrency): string {
  return formatter(`compact:${currency}`, () => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      })
    } catch {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact' })
    }
  }).format(n)
}

/** Symbol (or code) for the active currency, e.g. "$", "€", "₹". */
export function currencySymbol(currency = activeCurrency): string {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currency
    )
  } catch {
    return currency
  }
}

export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED', 'CHF', 'NZD', 'ZAR', 'BRL', 'MXN', 'SEK',
]

export function formatPct(n: number): string {
  return `${Math.round(n)}%`
}

export function sourceIconLabel(source: string): string {
  if (source === 'scan') return 'Scanned'
  if (source === 'demo') return 'Demo'
  if (source === 'recurring') return 'Recurring'
  if (source === 'import') return 'Imported'
  return 'Manual'
}

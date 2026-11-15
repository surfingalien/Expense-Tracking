// Date & period helpers shared by client and server.
// All calendar math is done on plain YYYY-MM-DD strings using UTC Date
// internals so results are deterministic and timezone-safe.

import type { TrendBucket } from '@/lib/types'

export type PeriodKey = 'today' | 'week' | 'month' | '30d' | 'year'
export type Granularity = 'day' | 'month'

export interface DateRange {
  start: string // YYYY-MM-DD inclusive
  end: string // YYYY-MM-DD inclusive
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD string into a UTC-based Date (midnight UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

function isoFromUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return isoFromUTC(d)
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

export function currentMonthKey(todayISO?: string): string {
  return monthKeyOf(todayISO ?? toISODate(new Date()))
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "Today" / "Yesterday" / "Mar 12" style label relative to a reference day. */
export function friendlyDayLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return 'Today'
  const yesterday = addDaysISO(todayISO, -1)
  if (iso === yesterday) return 'Yesterday'
  const d = parseISODate(iso)
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** Compact "Nov 2" style label used for dense daily charts. */
export function shortDayLabel(iso: string): string {
  const d = parseISODate(iso)
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatMonthKey(key: string, long = false): string {
  const [y, m] = key.split('-').map(Number)
  const months = long ? MONTHS_LONG : MONTHS_SHORT
  return `${months[(m || 1) - 1]} ${y}`
}

/** Monday-based weekday index (0 = Monday ... 6 = Sunday) */
function mondayIndex(iso: string): number {
  const d = parseISODate(iso)
  const js = d.getUTCDay() // 0 = Sunday
  return (js + 6) % 7
}

export function getPeriodRange(period: PeriodKey, todayISO: string): DateRange {
  switch (period) {
    case 'today':
      return { start: todayISO, end: todayISO }
    case 'week': {
      const offset = mondayIndex(todayISO)
      const start = addDaysISO(todayISO, -offset)
      return { start, end: todayISO }
    }
    case 'month': {
      const start = `${monthKeyOf(todayISO)}-01`
      return { start, end: todayISO }
    }
    case '30d': {
      const start = addDaysISO(todayISO, -29)
      return { start, end: todayISO }
    }
    case 'year': {
      const y = todayISO.slice(0, 4)
      return { start: `${y}-01-01`, end: todayISO }
    }
  }
}

export function getPrevPeriodRange(period: PeriodKey, todayISO: string): DateRange {
  const cur = getPeriodRange(period, todayISO)
  const days = Math.round((parseISODate(cur.end).getTime() - parseISODate(cur.start).getTime()) / 86400000) + 1
  switch (period) {
    case 'today':
      return { start: addDaysISO(todayISO, -1), end: addDaysISO(todayISO, -1) }
    case 'week':
      return { start: addDaysISO(cur.start, -7), end: addDaysISO(cur.start, -1) }
    case 'month': {
      const [y, m] = cur.start.split('-').map(Number)
      const prevMonth = m === 1 ? 12 : m - 1
      const prevYear = m === 1 ? Number(y) - 1 : Number(y)
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
      return {
        start: `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`,
        end: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      }
    }
    case '30d':
      return { start: addDaysISO(cur.start, -30), end: addDaysISO(cur.start, -1) }
    case 'year': {
      const y = Number(cur.start.slice(0, 4)) - 1
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    default:
      return { start: addDaysISO(cur.start, -days), end: addDaysISO(cur.start, -1) }
  }
}

export function daysBetween(startISO: string, endISO: string): number {
  const diff = parseISODate(endISO).getTime() - parseISODate(startISO).getTime()
  return Math.max(1, Math.round(diff / 86400000) + 1)
}

/** Build every bucket in [start, end]. Daily keys or monthly keys. */
export function listBuckets(startISO: string, endISO: string, granularity: Granularity): TrendBucket[] {
  const buckets: TrendBucket[] = []
  if (granularity === 'month') {
    let [y, m] = startISO.split('-').map(Number)
    const endKey = monthKeyOf(endISO)
    let guard = 0
    let key = `${y}-${String(m).padStart(2, '0')}`
    while (key <= endKey && guard < 120) {
      buckets.push({ key, label: formatMonthKey(key), amount: 0 })
      m += 1
      if (m > 12) { m = 1; y += 1 }
      key = `${y}-${String(m).padStart(2, '0')}`
      guard += 1
    }
    return buckets
  }
  let cursor = startISO
  let guard = 0
  while (cursor <= endISO && guard < 400) {
    const d = parseISODate(cursor)
    buckets.push({ key: cursor, label: WEEKDAYS_SHORT[d.getUTCDay()], amount: 0 })
    cursor = addDaysISO(cursor, 1)
    guard += 1
  }
  return buckets
}

export function bucketKeyOf(dateISO: string, granularity: Granularity): string {
  return granularity === 'month' ? monthKeyOf(dateISO) : dateISO
}

export function trendLabel(bucket: TrendBucket, granularity: Granularity): string {
  if (granularity === 'month') return formatMonthKey(bucket.key)
  if (bucket.label === WEEKDAYS_SHORT[parseISODate(bucket.key).getUTCDay()]) {
    // daily buckets: show "Mar 5" when more than ~10 buckets, else weekday
    return bucket.label
  }
  return bucket.label
}

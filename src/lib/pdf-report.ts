// Builds a polished, vector-drawn PDF expense report with pdf-lib.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { BudgetProgress, CategorySlice, MonthlyRow, TrendBucket } from '@/lib/types'

const EMERALD = rgb(0.02, 0.59, 0.41)
const EMERALD_DARK = rgb(0.01, 0.44, 0.31)
const INK = rgb(0.07, 0.09, 0.11)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.88, 0.9, 0.9)
const ZEBRA = rgb(0.965, 0.973, 0.969)
const ROSE = rgb(0.94, 0.27, 0.36)

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

export interface ReportExpenseRow {
  date: string
  merchant: string
  category: string
  description: string | null
  amount: number
}

export interface ReportData {
  periodLabel: string
  start: string
  end: string
  total: number
  count: number
  avgPerDay: number
  topCategory: string
  categories: CategorySlice[]
  budgets: BudgetProgress[]
  trend: TrendBucket[]
  expenses: ReportExpenseRow[]
  monthly: MonthlyRow[]
}

function sanitize(input: string): string {
  return input
    .replace(/\u20AC/g, 'EUR ')
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\u0000-\u00FF]/g, '?')
}

function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hexRGB(hex: string) {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[(m || 1) - 1]} ${d}, ${y}`
}

interface Ctx {
  doc: PDFDocument
  page: PDFPage
  y: number
  pageIndex: number
  pages: PDFPage[]
  font: PDFFont
  bold: PDFFont
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.pages.push(ctx.page)
  ctx.pageIndex += 1
  ctx.y = PAGE_H - MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 28) newPage(ctx)
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = sanitize(text)
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean
  let out = clean
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}...`
}

function drawSectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 44)
  ctx.page.drawText(sanitize(title), { x: MARGIN, y: ctx.y, size: 12.5, font: ctx.bold, color: INK })
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 7 },
    end: { x: MARGIN + CONTENT_W, y: ctx.y - 7 },
    thickness: 1,
    color: LINE,
  })
  ctx.y -= 22
}

function drawTableHeader(ctx: Ctx, cols: { x: number; w: number; label: string; align?: 'left' | 'right' }[]) {
  ensureSpace(ctx, 26)
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 6, width: CONTENT_W, height: 18, color: rgb(0.93, 0.95, 0.94) })
  for (const c of cols) {
    const text = sanitize(c.label)
    const x = c.align === 'right' ? c.x + c.w - ctx.bold.widthOfTextAtSize(text, 8.5) - 6 : c.x + 6
    ctx.page.drawText(text, { x, y: ctx.y - 1.5, size: 8.5, font: ctx.bold, color: MUTED })
  }
  ctx.y -= 20
}

function drawRow(
  ctx: Ctx,
  cols: { x: number; w: number; text: string; align?: 'left' | 'right'; color?: ReturnType<typeof rgb>; font?: PDFFont }[],
  zebra: boolean,
) {
  ensureSpace(ctx, 22)
  if (zebra) {
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 3.5, width: CONTENT_W, height: 16, color: ZEBRA })
  }
  for (const c of cols) {
    const f = c.font || ctx.font
    const text = fitText(c.text, f, 9, c.w - 10)
    const x = c.align === 'right' ? c.x + c.w - f.widthOfTextAtSize(text, 9) - 6 : c.x + 6
    ctx.page.drawText(text, { x, y: ctx.y, size: 9, font: f, color: c.color || INK })
  }
  ctx.y -= 16
}

function drawTrendChart(ctx: Ctx, buckets: TrendBucket[]) {
  const chartH = 130
  const labelH = 22
  ensureSpace(ctx, chartH + labelH + 30)

  const top = ctx.y
  const bottom = ctx.y - chartH
  const n = buckets.length
  const maxVal = Math.max(...buckets.map((b) => b.amount), 1)
  const niceMax = maxVal * 1.15

  // gridlines
  for (let i = 0; i <= 3; i++) {
    const gy = bottom + (chartH * i) / 3
    ctx.page.drawLine({ start: { x: MARGIN + 34, y: gy }, end: { x: MARGIN + CONTENT_W, y: gy }, thickness: 0.5, color: LINE })
    const label = money(Math.round((niceMax * i) / 3))
    ctx.page.drawText(label.length > 7 ? `$${Math.round((niceMax * i) / 3 / 1000)}k` : label, {
      x: MARGIN,
      y: gy - 3,
      size: 7,
      font: ctx.font,
      color: MUTED,
    })
  }

  // bars
  const plotX = MARGIN + 34
  const plotW = CONTENT_W - 34
  const gap = Math.min(6, (plotW / n) * 0.25)
  const barW = Math.max(2.5, (plotW - gap * (n - 1)) / n)
  buckets.forEach((b, i) => {
    const h = Math.max(b.amount > 0 ? 2 : 0, (b.amount / niceMax) * chartH)
    if (h > 0) {
      ctx.page.drawRectangle({
        x: plotX + i * (barW + gap),
        y: bottom,
        width: barW,
        height: h,
        color: EMERALD,
      })
    }
  })

  // x labels (max 12 shown)
  const labelEvery = Math.max(1, Math.ceil(n / 12))
  buckets.forEach((b, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return
    const x = plotX + i * (barW + gap)
    const label = sanitize(b.label)
    const centeredX = x - ctx.font.widthOfTextAtSize(label, 7) / 2 + barW / 2
    ctx.page.drawText(label, {
      x: Math.max(MARGIN, Math.min(centeredX, MARGIN + CONTENT_W - ctx.font.widthOfTextAtSize(label, 7))),
      y: bottom - 12,
      size: 7,
      font: ctx.font,
      color: MUTED,
    })
  })

  ctx.y = bottom - labelH - 6
}

function drawFooter(ctx: Ctx) {
  const totalPages = ctx.pages.length
  ctx.pages.forEach((p, idx) => {
    const text = `Page ${idx + 1} of ${totalPages}`
    const brand = 'Expense Tracker - AI Receipt Scanning & Analytics'
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 14 },
      end: { x: MARGIN + CONTENT_W, y: MARGIN + 14 },
      thickness: 0.5,
      color: LINE,
    })
    p.drawText(sanitize(brand), { x: MARGIN, y: MARGIN, size: 7.5, font: ctx.font, color: MUTED })
    p.drawText(text, {
      x: MARGIN + CONTENT_W - ctx.font.widthOfTextAtSize(text, 7.5),
      y: MARGIN,
      size: 7.5,
      font: ctx.font,
      color: MUTED,
    })
  })
}

function drawKPIBox(
  ctx: Ctx,
  x: number,
  w: number,
  label: string,
  value: string,
  sub?: string,
) {
  const h = 58
  ctx.page.drawRectangle({ x, y: ctx.y - h, width: w, height: h, color: ZEBRA })
  ctx.page.drawRectangle({ x, y: ctx.y - h, width: 3, height: h, color: EMERALD })
  ctx.page.drawText(sanitize(label), { x: x + 12, y: ctx.y - 16, size: 7.5, font: ctx.font, color: MUTED })
  const size = value.length > 14 ? 11 : 13
  ctx.page.drawText(sanitize(value), { x: x + 12, y: ctx.y - 34, size, font: ctx.bold, color: INK })
  if (sub) {
    ctx.page.drawText(sanitize(sub), { x: x + 12, y: ctx.y - 47, size: 7.5, font: ctx.font, color: MUTED })
  }
}

export async function buildExpenseReportPDF(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Expense Report ${data.periodLabel}`)
  doc.setProducer('Expense Tracker')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, pageIndex: 0, pages: [], font, bold }
  ctx.pages.push(ctx.page)

  // ---------- header ----------
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: EMERALD_DARK })
  ctx.page.drawText('Expense Report', { x: MARGIN, y: PAGE_H - 46, size: 22, font: bold, color: rgb(1, 1, 1) })
  ctx.page.drawText(sanitize(data.periodLabel), { x: MARGIN, y: PAGE_H - 66, size: 11, font, color: rgb(0.8, 0.94, 0.88) })
  const genText = `Generated ${fmtDate(new Date().toISOString().slice(0, 10))}`
  ctx.page.drawText(sanitize(genText), {
    x: MARGIN + CONTENT_W - bold.widthOfTextAtSize(sanitize(genText), 9),
    y: PAGE_H - 46,
    size: 9,
    font: bold,
    color: rgb(0.85, 0.96, 0.9),
  })
  ctx.y = PAGE_H - 130

  // ---------- KPI row ----------
  const kpiW = (CONTENT_W - 3 * 12) / 4
  drawKPIBox(ctx, MARGIN, kpiW, 'TOTAL SPENT', money(data.total))
  drawKPIBox(ctx, MARGIN + kpiW + 12, kpiW, 'TRANSACTIONS', String(data.count), `in ${data.trend.length} period(s)`)
  drawKPIBox(ctx, MARGIN + (kpiW + 12) * 2, kpiW, 'AVG PER DAY', money(data.avgPerDay))
  drawKPIBox(
    ctx,
    MARGIN + (kpiW + 12) * 3,
    kpiW,
    'TOP CATEGORY',
    fitText(data.topCategory || '-', bold, 11, kpiW - 20),
    data.categories[0] ? money(data.categories[0].total) : undefined,
  )
  ctx.y -= 78

  // ---------- category breakdown ----------
  drawSectionTitle(ctx, 'Category Breakdown')
  drawTableHeader(ctx, [
    { x: MARGIN, w: 200, label: 'CATEGORY' },
    { x: MARGIN + 200, w: 90, label: 'TXNS' },
    { x: MARGIN + 290, w: 110, label: 'AMOUNT', align: 'right' },
    { x: MARGIN + 400, w: 116, label: 'SHARE', align: 'right' },
  ])
  if (data.categories.length === 0) {
    drawRow(ctx, [{ x: MARGIN, w: CONTENT_W, text: 'No expenses recorded in this period.' }], false)
    ctx.y -= 6
  } else {
    data.categories.forEach((c, i) => {
      drawRow(
        ctx,
        [
          { x: MARGIN, w: 200, text: c.name, font: bold },
          { x: MARGIN + 200, w: 90, text: String(c.count) },
          { x: MARGIN + 290, w: 110, text: money(c.total), align: 'right', font: bold },
          { x: MARGIN + 400, w: 116, text: `${c.pct.toFixed(1)}%`, align: 'right' },
        ],
        i % 2 === 1,
      )
    })
  }
  ctx.y -= 14

  // ---------- budgets ----------
  if (data.budgets.length > 0) {
    drawSectionTitle(ctx, 'Budget Performance (This Month)')
    drawTableHeader(ctx, [
      { x: MARGIN, w: 150, label: 'CATEGORY' },
      { x: MARGIN + 150, w: 105, label: 'BUDGET', align: 'right' },
      { x: MARGIN + 255, w: 105, label: 'SPENT', align: 'right' },
      { x: MARGIN + 360, w: 156, label: 'STATUS', align: 'right' },
    ])
    data.budgets.forEach((b, i) => {
      const remaining = b.budget - b.spent
      const status = b.over ? `Over by ${money(Math.abs(remaining))}` : `${money(remaining)} left`
      drawRow(
        ctx,
        [
          { x: MARGIN, w: 150, text: b.name, font: bold },
          { x: MARGIN + 150, w: 105, text: money(b.budget), align: 'right' },
          { x: MARGIN + 255, w: 105, text: money(b.spent), align: 'right' },
          { x: MARGIN + 360, w: 156, text: status, align: 'right', color: b.over ? ROSE : EMERALD, font: bold },
        ],
        i % 2 === 1,
      )
    })
    ctx.y -= 14
  }

  // ---------- trend ----------
  // keep the section title together with the chart (~180pt block)
  ensureSpace(ctx, 40 + 130 + 24 + 30)
  drawSectionTitle(ctx, 'Spending Trend')
  drawTrendChart(ctx, data.trend)
  ctx.y -= 8

  // ---------- monthly summary ----------
  if (data.monthly.length > 1) {
    drawSectionTitle(ctx, 'Monthly Summary')
    drawTableHeader(ctx, [
      { x: MARGIN, w: 160, label: 'MONTH' },
      { x: MARGIN + 160, w: 120, label: 'TXNS' },
      { x: MARGIN + 280, w: 236, label: 'TOTAL', align: 'right' },
    ])
    data.monthly.forEach((m, i) => {
      drawRow(
        ctx,
        [
          { x: MARGIN, w: 160, text: fmtMonth(m.month), font: bold },
          { x: MARGIN + 160, w: 120, text: String(m.count) },
          { x: MARGIN + 280, w: 236, text: money(m.total), align: 'right' },
        ],
        i % 2 === 1,
      )
    })
    ctx.y -= 14
  }

  // ---------- transactions ----------
  drawSectionTitle(ctx, `Transactions (${data.expenses.length})`)
  drawTableHeader(ctx, [
    { x: MARGIN, w: 78, label: 'DATE' },
    { x: MARGIN + 78, w: 205, label: 'MERCHANT' },
    { x: MARGIN + 283, w: 125, label: 'CATEGORY' },
    { x: MARGIN + 408, w: 108, label: 'AMOUNT', align: 'right' },
  ])
  if (data.expenses.length === 0) {
    drawRow(ctx, [{ x: MARGIN, w: CONTENT_W, text: 'No expenses recorded in this period.' }], false)
  } else {
    data.expenses.forEach((e, i) => {
      drawRow(
        ctx,
        [
          { x: MARGIN, w: 78, text: fmtDate(e.date) },
          { x: MARGIN + 78, w: 205, text: e.merchant, font: bold },
          { x: MARGIN + 283, w: 125, text: e.category },
          { x: MARGIN + 408, w: 108, text: money(e.amount), align: 'right', font: bold },
        ],
        i % 2 === 1,
      )
    })
  }

  drawFooter(ctx)
  return doc.save()
}

function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[(m || 1) - 1]} ${y}`
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ISO_DATE, jsonError, parseAmountCents, withUser } from '@/lib/api'
import { matchCategory } from '@/lib/categories'
import type { ImportRowResult } from '@/lib/types'

const MAX_ROWS = 2000

/**
 * Imports expenses parsed client-side from a bank CSV. Categories are matched
 * by name when given, otherwise guessed from the merchant. Exact duplicates
 * (same date, merchant and amount) are skipped, so re-importing is safe.
 */
export const POST = withUser('POST /api/import', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as { rows?: unknown }
  if (!Array.isArray(body.rows) || body.rows.length === 0) return jsonError('No rows to import')
  if (body.rows.length > MAX_ROWS) return jsonError(`Import at most ${MAX_ROWS} rows at a time`)

  const categories = await db.category.findMany({ where: { userId } })
  const catList = categories.map((c) => ({ id: c.id, name: c.name }))
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
  const fallback = categories.find((c) => c.name === 'Other')?.id || categories[0]?.id
  if (!fallback) return jsonError('Create a category first')

  const result: ImportRowResult = { imported: 0, skipped: 0, errors: [] }
  const valid: { date: string; merchant: string; amountCents: number; categoryId: string; description: string | null }[] = []
  body.rows.forEach((raw, i) => {
    const r = (raw || {}) as Record<string, unknown>
    const date = typeof r.date === 'string' ? r.date.trim() : ''
    const merchant = typeof r.merchant === 'string' ? r.merchant.trim().slice(0, 120) : ''
    const amountCents = parseAmountCents(typeof r.amount === 'number' ? Math.abs(r.amount) : r.amount)
    if (!ISO_DATE.test(date) || !merchant || amountCents == null) {
      result.skipped += 1
      if (result.errors.length < 10) result.errors.push(`Row ${i + 1}: needs a valid date, description and amount`)
      return
    }
    const catName = typeof r.category === 'string' ? r.category.trim().toLowerCase() : ''
    const categoryId = byName.get(catName) || matchCategory(catName || null, merchant, [], catList) || fallback
    const description = typeof r.description === 'string' ? r.description.trim().slice(0, 300) || null : null
    valid.push({ date, merchant, amountCents, categoryId, description })
  })

  if (valid.length) {
    const dates = valid.map((v) => v.date).sort()
    const existing = await db.expense.findMany({
      where: { userId, date: { gte: dates[0], lte: dates[dates.length - 1] } },
      select: { date: true, merchant: true, amountCents: true },
    })
    const seen = new Set(existing.map((e) => `${e.date}|${e.merchant.toLowerCase()}|${e.amountCents}`))
    const fresh = valid.filter((v) => {
      const key = `${v.date}|${v.merchant.toLowerCase()}|${v.amountCents}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    result.skipped += valid.length - fresh.length
    if (fresh.length) {
      const created = await db.expense.createMany({
        data: fresh.map((v) => ({ ...v, userId, source: 'import' })),
      })
      result.imported = created.count
    }
  }
  return NextResponse.json(result)
})

import { NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import sharp from 'sharp'
import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { matchCategory } from '@/lib/categories'
import { toISODate } from '@/lib/period'
import { blobConfigured, storeReceipt } from '@/lib/receipts'
import type { ExpenseItem, ScanResult } from '@/lib/types'

export const maxDuration = 60

// Vision model routed through the Vercel AI Gateway. On Vercel the gateway
// authenticates with the project's OIDC token automatically; locally set
// AI_GATEWAY_API_KEY (or run `vercel env pull`).
const SCAN_MODEL = process.env.RECEIPT_SCAN_MODEL || 'google/gemini-3.5-flash'

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|bmp|heic|heif);base64,(.+)$/
const MAX_UPLOAD = 10 * 1024 * 1024 // 10MB

const receiptSchema = z.object({
  merchant: z.string().describe('Store or business name printed on the receipt'),
  date: z.string().nullable().describe('Receipt date as YYYY-MM-DD, or null if unreadable'),
  total: z.number().nullable().describe('Final grand total paid, after tax, tips and discounts'),
  tax: z.number().nullable().describe('Sales tax amount if shown'),
  items: z
    .array(z.object({ name: z.string(), price: z.number(), qty: z.number().nullable() }))
    .describe('Line items with prices, at most 30'),
  category: z.string().describe('Best-fit spending category from the provided list'),
  confidence: z.enum(['high', 'medium', 'low']),
})

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Parse a variety of receipt date formats into YYYY-MM-DD, or null. */
function parseReceiptDate(raw: unknown, today: string): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  const todayDate = new Date(`${today}T00:00:00Z`)
  const clamp = (y: number, m: number, d: number): string | null => {
    if (y < 2000 || y > todayDate.getUTCFullYear() + 1) return null
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    // future dates beyond tomorrow are likely OCR misreads
    if (new Date(`${iso}T00:00:00Z`).getTime() > todayDate.getTime() + 86400000) return null
    return iso
  }

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return clamp(Number(m[1]), Number(m[2]), Number(m[3]))
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/) // MM/DD/YYYY (US default)
  if (m) return clamp(Number(m[3]), Number(m[1]), Number(m[2]))
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/) // 15 Mar 2024
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mo) return clamp(Number(m[3]), mo, Number(m[1]))
  }
  m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/) // Mar 15, 2024
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (mo) return clamp(Number(m[3]), mo, Number(m[2]))
  }
  m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/)
  if (m) return clamp(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function cleanItems(raw: z.infer<typeof receiptSchema>['items']): ExpenseItem[] {
  return raw
    .filter((i) => i.name.trim() && Number.isFinite(i.price) && i.price >= 0)
    .slice(0, 30)
    .map((i) => ({
      name: i.name.trim().slice(0, 120),
      price: round2(i.price),
      qty: i.qty != null && i.qty > 0 ? Math.round(i.qty) : null,
    }))
}

export const POST = withUser('POST /api/scan', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as { image?: unknown; today?: unknown }
  if (typeof body.image !== 'string') return jsonError('No receipt image provided')
  const match = body.image.match(DATA_URL_RE)
  if (!match) return jsonError('Unsupported image format. Use PNG, JPEG, WebP, GIF or BMP.')
  if (body.image.length > MAX_UPLOAD) return jsonError('Image is too large (max 10MB)', 413)

  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : toISODate(new Date())

  // Normalize to a reasonably sized JPEG: used both for the model and storage.
  let jpeg: Buffer
  try {
    jpeg = await sharp(Buffer.from(match[2], 'base64'))
      .rotate()
      .resize(1600, 2200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return jsonError('Could not read this image. Try a different photo.')
  }

  const categories = await db.category.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  let parsed: z.infer<typeof receiptSchema>
  try {
    const { output } = await generateText({
      model: SCAN_MODEL,
      output: Output.object({ schema: receiptSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract the data from this receipt or invoice. Choose "category" from: ${categories
                .map((c) => c.name)
                .join(', ')}. If something is unreadable use null.`,
            },
            { type: 'file', mediaType: 'image/jpeg', data: jpeg },
          ],
        },
      ],
    })
    parsed = output
  } catch (err) {
    console.error('Receipt model call failed:', err)
    return jsonError('The AI could not read this receipt. Try a clearer photo or enter it manually.', 422)
  }

  const items = cleanItems(parsed.items)
  const merchant = parsed.merchant.trim().slice(0, 120) || 'Unknown merchant'
  const date = parseReceiptDate(parsed.date, today) || today
  let total = parsed.total != null && parsed.total >= 0 ? round2(parsed.total) : null
  if (total == null && items.length) total = round2(items.reduce((s, i) => s + i.price * (i.qty || 1), 0))
  const tax = parsed.tax != null && parsed.tax >= 0 ? round2(parsed.tax) : null
  const categoryId = matchCategory(
    parsed.category,
    merchant,
    items.map((i) => i.name),
    categories.map((c) => ({ id: c.id, name: c.name })),
  )
  const categoryName = categories.find((c) => c.id === categoryId)?.name || 'Other'

  // Keep the receipt in private Blob storage (skipped if no store is connected).
  let receiptPath: string | null = null
  if (blobConfigured()) {
    try {
      receiptPath = await storeReceipt(userId, jpeg)
    } catch (err) {
      console.error('Storing receipt image failed:', err)
    }
  }

  const thumb = await sharp(jpeg).resize(500, 700, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer()
  const result: ScanResult = {
    merchant,
    date,
    total,
    tax,
    items,
    categoryId: categoryId || categories[0]?.id || '',
    categoryName,
    confidence: parsed.confidence,
    thumbnail: `data:image/jpeg;base64,${thumb.toString('base64')}`,
    receiptPath,
  }
  return NextResponse.json(result)
})

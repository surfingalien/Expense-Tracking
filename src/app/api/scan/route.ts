import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { matchCategory } from '@/lib/categories'
import { toISODate } from '@/lib/period'
import type { ExpenseItem, ScanResult } from '@/lib/types'

export const maxDuration = 60

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|bmp);base64,(.+)$/
const MAX_UPLOAD = 10 * 1024 * 1024 // 10MB

function todayISO(): string {
  return toISODate(new Date())
}

function extractJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  // strip markdown code fences if the model added them
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  try {
    return JSON.parse(t.slice(first, last + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

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

function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '')
    const n = Number(cleaned.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100
  }
  return null
}

function parseItems(raw: unknown): ExpenseItem[] {
  if (!Array.isArray(raw)) return []
  const items: ExpenseItem[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const obj = it as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 120) : ''
    const price = parseAmount(obj.price)
    if (!name || price == null) continue
    const qtyRaw = Number(obj.qty)
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw) : null
    items.push({ name, price, qty })
  }
  return items.slice(0, 30)
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeed()
    const body = (await req.json()) as { image?: unknown }
    if (typeof body.image !== 'string') {
      return NextResponse.json({ error: 'No receipt image provided' }, { status: 400 })
    }
    const match = body.image.match(DATA_URL_RE)
    if (!match) {
      return NextResponse.json({ error: 'Unsupported image format. Use PNG, JPEG, WebP, GIF or BMP.' }, { status: 400 })
    }
    if (body.image.length > MAX_UPLOAD) {
      return NextResponse.json({ error: 'Image is too large (max 10MB)' }, { status: 413 })
    }

    const imageBuffer = Buffer.from(match[2], 'base64')
    const today = todayISO()

    // Downscale + compress for storage (receipt preview thumbnail)
    let thumbnail: string | null = null
    try {
      const small = await sharp(imageBuffer)
        .resize(1100, 1500, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer()
      thumbnail = `data:image/jpeg;base64,${small.toString('base64')}`
    } catch (e) {
      console.warn('Receipt thumbnail generation failed, storing original if small enough:', e)
      if (imageBuffer.length <= 1_200_000) thumbnail = body.image
    }

    const zai = await ZAI.create()
    const categories = await db.category.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
    const categoryList = categories.map((c) => c.name).join(', ')

    const prompt = `You are a receipt and invoice data extraction engine. Read the receipt image and extract structured data. Respond with ONLY a valid JSON object — no markdown fences, no commentary — using exactly this schema:
{"merchant": string, "date": string | null, "total": number | null, "tax": number | null, "items": [{"name": string, "price": number, "qty": number | null}], "category": string, "confidence": "high" | "medium" | "low"}

Rules:
- merchant: the store or business name on the receipt.
- date: the receipt date formatted as YYYY-MM-DD. If only partially readable, fill in what you can; if unreadable, use null.
- total: the final grand total paid (after tax, tips and discounts). If unreadable, null.
- tax: the sales tax amount if shown, otherwise null.
- items: line items with their prices; qty null if not shown. Maximum 30 items.
- category: the single best-fit spending category for this purchase, chosen from this list: ${categoryList}.
- confidence: how confident you are in the extraction.`

    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: body.image } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'The AI could not read this receipt. Try a clearer photo.' }, { status: 422 })
    }
    const parsed = extractJSON(content)
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse the receipt. Try a clearer photo.' }, { status: 422 })
    }

    const items = parseItems(parsed.items)
    const merchant = typeof parsed.merchant === 'string' && parsed.merchant.trim() ? parsed.merchant.trim().slice(0, 120) : 'Unknown merchant'
    const date = parseReceiptDate(parsed.date, today) || today
    let total = parseAmount(parsed.total)
    if (total == null && items.length) total = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100
    const tax = parseAmount(parsed.tax)
    const confidence = parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium'
    const categoryId = matchCategory(
      typeof parsed.category === 'string' ? parsed.category : null,
      merchant,
      items.map((i) => i.name),
      categories.map((c) => ({ id: c.id, name: c.name })),
    )
    const categoryName = categories.find((c) => c.id === categoryId)?.name || 'Other'

    const result: ScanResult = {
      merchant,
      date,
      total,
      tax,
      items,
      categoryId: categoryId || categories[0]?.id || '',
      categoryName,
      confidence,
      thumbnail,
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/scan failed:', err)
    return NextResponse.json({ error: 'Receipt scanning failed. Please try again or enter manually.' }, { status: 500 })
  }
}

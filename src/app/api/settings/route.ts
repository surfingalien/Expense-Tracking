import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'

function isCurrency(code: string): boolean {
  try {
    return Intl.supportedValuesOf('currency').includes(code)
  } catch {
    return /^[A-Z]{3}$/.test(code)
  }
}

export const GET = withUser('GET /api/settings', async (_req, _ctx, { userId }) => {
  const s = await db.userSettings.findUnique({ where: { userId } })
  return NextResponse.json({ currency: s?.currency || 'USD' })
})

export const PUT = withUser('PUT /api/settings', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as { currency?: unknown }
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
  if (!isCurrency(currency)) return jsonError('Unknown currency code')
  const s = await db.userSettings.update({ where: { userId }, data: { currency } })
  return NextResponse.json({ currency: s.currency })
})

import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { ensureUserSetup } from '@/lib/seed'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export interface UserContext {
  userId: string
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }, user: UserContext) => Promise<Response>

/**
 * Wraps an API route handler so it only runs for a signed-in user, after the
 * user's data is bootstrapped. Unexpected errors become a JSON 500.
 */
export function withUser<P = Record<string, never>>(label: string, handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const userId = await getUserId()
    if (!userId) return jsonError('Sign in required', 401)
    try {
      await ensureUserSetup(userId, req.nextUrl.searchParams.get('today') || undefined)
      return await handler(req, ctx, { userId })
    } catch (err) {
      console.error(`${label} failed:`, err)
      return jsonError(`${label} failed`, 500)
    }
  }
}

/** Parses a positive money amount from user input into integer cents. */
export function parseAmountCents(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw.replace(/[^0-9.-]/g, '')) : Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null
  return Math.round(n * 100)
}

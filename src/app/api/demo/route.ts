import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, withUser } from '@/lib/api'
import { seedDemoExpenses } from '@/lib/seed'
import { toISODate } from '@/lib/period'

export const POST = withUser('POST /api/demo', async (req, _ctx, { userId }) => {
  const body = (await req.json()) as { action?: unknown; today?: unknown }
  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : toISODate(new Date())

  if (body.action === 'load') {
    await db.expense.deleteMany({ where: { userId, isDemo: true } })
    const count = await seedDemoExpenses(userId, today)
    return NextResponse.json({ ok: true, action: 'load', seeded: count })
  }
  if (body.action === 'clear') {
    // Only remove sample data; expenses the user added are never touched.
    const removed = await db.expense.deleteMany({ where: { userId, isDemo: true } })
    return NextResponse.json({ ok: true, action: 'clear', removed: removed.count })
  }
  return jsonError('Unknown action. Use "load" or "clear".')
})

export const GET = withUser('GET /api/demo', async (_req, _ctx, { userId }) => {
  const [expenses, categories, demoExpenses] = await Promise.all([
    db.expense.count({ where: { userId } }),
    db.category.count({ where: { userId } }),
    db.expense.count({ where: { userId, isDemo: true } }),
  ])
  return NextResponse.json({ expenses, categories, demoExpenses })
})

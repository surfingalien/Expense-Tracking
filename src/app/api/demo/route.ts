import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedDemoExpenses, ensureSeed } from '@/lib/seed'
import { toISODate } from '@/lib/period'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action?: unknown; today?: unknown }
    const action = body.action === 'clear' ? 'clear' : body.action === 'load' ? 'load' : null
    const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : toISODate(new Date())

    await ensureSeed(today)

    if (action === 'load') {
      await db.expense.deleteMany({ where: { isDemo: true } })
      const count = await seedDemoExpenses(today)
      return NextResponse.json({ ok: true, action, seeded: count })
    }
    if (action === 'clear') {
      // Only remove sample data; expenses the user added are never touched.
      const removed = await db.expense.deleteMany({ where: { isDemo: true } })
      return NextResponse.json({ ok: true, action, removed: removed.count })
    }
    return NextResponse.json({ error: 'Unknown action. Use "load" or "clear".' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/demo failed:', err)
    return NextResponse.json({ error: 'Demo data operation failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const [expenses, categories, demoExpenses] = await Promise.all([
      db.expense.count(),
      db.category.count(),
      db.expense.count({ where: { isDemo: true } }),
    ])
    return NextResponse.json({ expenses, categories, demoExpenses })
  } catch (err) {
    console.error('GET /api/demo failed:', err)
    return NextResponse.json({ error: 'Failed to load data status' }, { status: 500 })
  }
}

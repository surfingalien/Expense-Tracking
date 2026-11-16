import { redirect } from 'next/navigation'
import { ExpenseApp } from '@/components/expense-tracker/expense-app'
import { getUserId } from '@/lib/auth'

export default async function Home() {
  // Every API route also checks the session (see withUser in src/lib/api.ts).
  if (!(await getUserId())) redirect('/sign-in')
  return <ExpenseApp />
}

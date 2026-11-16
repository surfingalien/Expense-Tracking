'use client'

import { UserButton } from '@clerk/nextjs'
import { useAuthEnabled } from '@/app/providers'

/** Clerk account menu; hidden in local dev when sign-in is bypassed. */
export function AccountButton() {
  const enabled = useAuthEnabled()
  if (!enabled) return null
  return <UserButton />
}

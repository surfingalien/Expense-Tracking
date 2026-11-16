import { auth } from '@clerk/nextjs/server'

/**
 * Local-development escape hatch so the app can be exercised without Clerk
 * keys. It is ignored in production builds (NODE_ENV is always "production"
 * there), so it can never bypass sign-in on Vercel.
 */
export const devBypassUserId =
  process.env.NODE_ENV === 'development' ? process.env.DEV_AUTH_BYPASS_USER_ID || undefined : undefined

/** Returns the signed-in user's id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  if (devBypassUserId) return devBypassUserId
  const { userId } = await auth()
  return userId
}

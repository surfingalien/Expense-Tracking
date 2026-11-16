import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Clerk's middleware makes the session available to `auth()`. Access control
// itself happens where the data is: the home page redirects signed-out users
// to /sign-in and every API route rejects them (src/lib/api.ts).
const devBypass = process.env.NODE_ENV === 'development' && Boolean(process.env.DEV_AUTH_BYPASS_USER_ID)

export default devBypass ? () => NextResponse.next() : clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

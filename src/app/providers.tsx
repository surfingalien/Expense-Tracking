'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useState } from 'react'
import { Toaster } from 'sonner'

const AuthEnabledContext = createContext(true)

/** False only in local development when sign-in is bypassed. */
export function useAuthEnabled() {
  return useContext(AuthEnabledContext)
}

export function Providers({ children, authEnabled = true }: { children: React.ReactNode; authEnabled?: boolean }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <AuthEnabledContext.Provider value={authEnabled}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </AuthEnabledContext.Provider>
  )
}

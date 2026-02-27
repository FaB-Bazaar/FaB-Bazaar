"use client"

import type React from "react"
import { SessionProvider } from "next-auth/react"

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchIntervalInBackground={false}
    >
      {children}
    </SessionProvider>
  )
}
"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { recordPageView, trackLogin } from "@/lib/gtag"

// Sends one GA page_view per route change and keeps the `user_type` user
// property in step with the session.
//
// Ordering matters: next-auth's useSession starts as "loading" on every hard
// load, so nothing is sent until the session resolves — otherwise the entry
// page of every signed-in visitor was stamped user_type=anonymous (verified in
// the live collect request). The cost is that the first page_view waits for
// /api/auth/session; a visitor who leaves before it resolves is not counted.
export function AnalyticsListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const prevStatusRef = useRef<typeof status | undefined>(undefined)
  const lastSentPathRef = useRef<string | null>(null)

  const sessionResolved = status !== "loading"

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return
    if (!sessionResolved) return
    const userType = status === "authenticated" ? "authenticated" : "anonymous"
    window.gtag("set", "user_properties", { user_type: userType })

    // Fire GA `login` event on unauthenticated → authenticated transition
    if (prevStatusRef.current === "unauthenticated" && status === "authenticated") {
      trackLogin("discord")
    }
    prevStatusRef.current = status
  }, [status, sessionResolved, session?.user?.id])

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return
    if (!sessionResolved) return
    const gaId = process.env.NEXT_PUBLIC_GA_ID
    if (!gaId) return

    const query = searchParams?.toString()
    const pagePath = query ? `${pathname}?${query}` : pathname
    // Dedupe on the path string, not on hook identity: a re-render that is not
    // a navigation (session settling, a parent state change) must not resend.
    if (lastSentPathRef.current === pagePath) return
    lastSentPathRef.current = pagePath
    recordPageView(pagePath)

    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [pathname, searchParams, sessionResolved])

  return null
}

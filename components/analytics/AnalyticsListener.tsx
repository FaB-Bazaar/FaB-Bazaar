"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { trackLogin } from "@/lib/gtag"

export function AnalyticsListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const prevStatusRef = useRef<typeof status | undefined>(undefined)

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return
    const userType = status === "authenticated" ? "authenticated" : "anonymous"
    window.gtag("set", "user_properties", { user_type: userType })

    // Fire GA `login` event on unauthenticated → authenticated transition
    if (prevStatusRef.current === "unauthenticated" && status === "authenticated") {
      trackLogin("discord")
    }
    prevStatusRef.current = status
  }, [status, session?.user?.id])

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return
    const gaId = process.env.NEXT_PUBLIC_GA_ID
    if (!gaId) return

    const query = searchParams?.toString()
    const pagePath = query ? `${pathname}?${query}` : pathname

    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [pathname, searchParams])

  return null
}

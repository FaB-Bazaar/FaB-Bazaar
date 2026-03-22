"use client"

import { useEffect, useRef, useState, useContext } from "react"
import { usePathname } from "next/navigation"
import { useCookieConsent } from "@/contexts/CookieConsentContext"
import { AuthContext } from "@/contexts/AuthContext"
import { useAdsConfig } from "@/contexts/AdsConfigContext"

export function MobileAnchorAd() {
  const authContext = useContext(AuthContext)
  const { adsEnabled } = useAdsConfig()
  const { consentGiven, consentOptions } = useCookieConsent()
  const adRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [debugInfo, setDebugInfo] = useState("")

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth
      setIsMobile(width < 640)
      setDebugInfo(`Width: ${width}px | Mobile: ${width < 640} | Consent: ${consentGiven} | Advertising: ${consentOptions.advertising}`)
    }

    checkMobile() // Initial check
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [consentGiven, consentOptions.advertising])

  // Initialize the ad when the component mounts and consent is given
  useEffect(() => {
    if (typeof window === "undefined" || !adRef.current || !consentGiven || !consentOptions.advertising || !isMobile) return

    try {
      // Push the adsbygoogle command
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error("AdSense mobile anchor error:", error)
    }
  }, [consentGiven, consentOptions.advertising, isMobile])

  // Development debug display
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Don't show ads if disabled site-wide or to premium Patreon supporters
  if (!adsEnabled || authContext?.user?.isMetafySupporter) {
    return null
  }

  if (isDevelopment && (!isMobile || !consentGiven)) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[40] bg-yellow-500 text-black p-2 text-xs font-mono">
        DEBUG: {debugInfo}
      </div>
    )
  }

  // Don't show on desktop or if user hasn't loaded yet
  if (!isMobile || !consentGiven) {
    return null
  }

  // If user hasn't consented to advertising cookies, show alternative content
  if (!consentOptions.advertising) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[40] bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 sm:hidden">
        <div className="max-w-screen-sm mx-auto">
          <div className="text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Support this site by enabling ads
            </p>
            <button
              onClick={() => document.dispatchEvent(new Event("openCookiePreferences"))}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Enable in Cookie Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render the AdSense mobile anchor ad
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[40] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:hidden ${
        isDevelopment ? 'border-4 border-green-500' : ''
      }`}
    >
      {isDevelopment && (
        <div className="bg-green-500 text-white text-xs p-1 font-mono text-center">
          AD ACTIVE: {debugInfo}
        </div>
      )}
      <div className="flex justify-center items-center p-1">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "inline-block", width: "320px", height: "50px" }}
          data-ad-client="ca-pub-8256117741560128"
          data-ad-slot="5669921819"
          data-ad-format="horizontal"
        />
      </div>
    </div>
  )
}

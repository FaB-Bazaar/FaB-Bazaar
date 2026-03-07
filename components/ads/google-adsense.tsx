"use client"

import { useEffect, useRef, useContext } from "react"
import { useCookieConsent } from "@/contexts/CookieConsentContext"
import { AuthContext } from "@/contexts/AuthContext"

interface GoogleAdsenseProps {
  adSlot: string
  adFormat?: "auto" | "horizontal" | "vertical" | "rectangle" | "fluid"
  className?: string
  style?: React.CSSProperties
}

export function GoogleAdsense({ adSlot, adFormat = "auto", className = "", style }: GoogleAdsenseProps) {
  const authContext = useContext(AuthContext)
  const { consentGiven, consentOptions } = useCookieConsent()
  const adRef = useRef<HTMLDivElement>(null)
  const scriptLoaded = useRef(false)
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Load AdSense script if not already loaded
  useEffect(() => {
    if (typeof window === "undefined" || scriptLoaded.current) return

    // Only load AdSense if consent has been given
    if (consentGiven) {
      // Check if script is already in the document
      if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
        const script = document.createElement("script")
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
        script.async = true
        script.setAttribute("data-ad-client", "ca-pub-8256117741560128") 

        // Set non-personalized ads if user declined advertising cookies
        if (!consentOptions.advertising) {
          script.setAttribute("data-non-personalized-ads", "1")
        }

        document.head.appendChild(script)
        scriptLoaded.current = true
      }
    }
  }, [consentGiven, consentOptions.advertising])

  // Initialize the ad when the component mounts and consent is given
  useEffect(() => {
    if (typeof window === "undefined" || !adRef.current || !consentGiven) return

    try {
      // Push the adsbygoogle command
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error("AdSense error:", error)
    }
  }, [consentGiven])

  // Don't show ads to premium Patreon supporters (check after all hooks)
  if (authContext?.user?.isPatreon) {
    return null
  }

  // Don't render anything if consent hasn't been given
  if (!consentGiven) {
    return null
  }

  // If user hasn't consented to advertising cookies, show alternative content
  if (!consentOptions.advertising) {
    return (
      <div className={`ad-container ${className}`}>
        <div className="p-4 bg-gray-100 text-center rounded">
          <p className="text-sm text-gray-600">
            You've opted out of personalized ads. Enable advertising cookies for a better ad experience.
          </p>
          <button
            onClick={() => document.dispatchEvent(new Event("openCookiePreferences"))}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            Manage Cookie Preferences
          </button>
        </div>
      </div>
    )
  }

  // Render the AdSense ad unit
  return (
    <div className={`ad-container ${className}`} style={{ margin: "0 auto", padding: 0, lineHeight: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          ...(style || {}),
          display: "block",
          width: "100%",
          margin: "0 auto",
          padding: 0,
        }}
        data-ad-client="ca-pub-8256117741560128"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
      {isDevelopment && (
        <div className="fixed bottom-20 right-4 bg-green-500 text-white text-xs p-2 font-mono rounded shadow-lg z-50 max-w-xs">
          Ad Debug: Slot {adSlot} | {adFormat} | Consent: {consentGiven ? '✓' : '✗'}
        </div>
      )}
    </div>
  )
}

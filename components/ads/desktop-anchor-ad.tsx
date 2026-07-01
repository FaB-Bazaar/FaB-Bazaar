"use client"

import { useContext } from "react"
import { GoogleAdsense } from "@/components/ads/google-adsense"
import { AuthContext } from "@/contexts/AuthContext"
import { useAdsConfig } from "@/contexts/AdsConfigContext"

interface DesktopAnchorAdProps {
  className?: string  // Optional: additional classes for container
}

export function DesktopAnchorAd({ className = "" }: DesktopAnchorAdProps) {
  const authContext = useContext(AuthContext)
  const { adsEnabled } = useAdsConfig()

  if (!adsEnabled) return null

  // Don't show ads to premium Patreon supporters
  if (authContext?.user?.isMetafySupporter) {
    return null
  }

  return (
    <div className={`hidden sm:block fixed bottom-0 left-0 right-0 z-[40] bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-center py-2 w-full">
        <div className="flex items-center justify-center w-full max-w-6xl mx-auto px-4">
          <GoogleAdsense
            adSlot="5669921819"
            adFormat="horizontal"
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

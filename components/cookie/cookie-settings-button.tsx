//components/cookie/cookie-settings-button.tsx
"use client"

import type React from "react"

import { useEffect } from "react"
import { useCookieConsent } from "@/contexts/CookieConsentContext"
import { Button, type ButtonProps } from "@/components/ui/button"

interface CookieSettingsButtonProps extends ButtonProps {
  children?: React.ReactNode
}

export function CookieSettingsButton({ children, ...props }: CookieSettingsButtonProps) {
  const { openPreferences } = useCookieConsent()

  // Listen for the openCookiePreferences event
  useEffect(() => {
    const handleOpenPreferences = () => {
      openPreferences()
    }

    document.addEventListener("openCookiePreferences", handleOpenPreferences)

    return () => {
      document.removeEventListener("openCookiePreferences", handleOpenPreferences)
    }
  }, [openPreferences])

  return (
    <Button onClick={openPreferences} variant="ghost" size="sm" className="text-xs" {...props}>
      {children || "Cookie Settings"}
    </Button>
  )
}
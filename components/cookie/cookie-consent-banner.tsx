"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useCookieConsent } from "@/contexts/CookieConsentContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CookieConsentBanner() {
  const { consentGiven, consentOptions, acceptAll, rejectAll, customizeConsent, showPreferences, setShowPreferences } = useCookieConsent()

  // Initialize preferences with privacy-first defaults
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: false, // GDPR compliant default
    analytics: false,  // GDPR compliant default
    advertising: false, // GDPR compliant default
  })

  // Add this to prevent flash on load
  const [isInitialized, setIsInitialized] = useState(false)

  // Check initialization on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 100) // Small delay to let context load
    
    return () => clearTimeout(timer)
  }, [])

  // Update preferences when dialog opens
  useEffect(() => {
    if (showPreferences) {
      if (consentGiven) {
        // If consent already given, load current preferences
        setPreferences(consentOptions)
      } else {
        // If no consent yet, start with privacy-first defaults
        setPreferences({
          necessary: true,
          functional: false,
          analytics: false,
          advertising: false,
        })
      }
    }
  }, [showPreferences, consentGiven, consentOptions])

  // Listen for the openCookiePreferences event
  useEffect(() => {
    const handleOpenPreferences = () => {
      setShowPreferences(true)
    }

    document.addEventListener("openCookiePreferences", handleOpenPreferences)

    return () => {
      document.removeEventListener("openCookiePreferences", handleOpenPreferences)
    }
  }, [setShowPreferences])

  // Don't render until initialized OR if consent already given
  if (!isInitialized || (consentGiven && !showPreferences)) {
    return null
  }

  const handleCustomize = () => {
    customizeConsent(preferences)
    setShowPreferences(false)
  }

  const handleAcceptAll = () => {
    acceptAll()
    setShowPreferences(false)
  }

  const handleRejectAll = () => {
    rejectAll()
    setShowPreferences(false)
  }

  return (
    <>
      {/* Main Banner */}
      {!consentGiven && !showPreferences && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg p-4 md:p-6 z-50"
          style={{ 
            pointerEvents: 'auto'  // Keep this for explicit clickability
          }}
        >
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Cookie Preferences</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our
                  traffic. You can choose which cookies to accept. Necessary cookies are always active.{" "}
                  <a href="/privacy-policy" className="text-blue-600 hover:underline">
                    Learn more in our Privacy Policy
                  </a>
                </p>
                <button 
                  onClick={() => setShowPreferences(true)} 
                  className="text-sm text-blue-600 hover:underline cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                >
                  Customize preferences
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0" style={{ pointerEvents: 'auto' }}>
                <Button 
                  variant="outline" 
                  onClick={handleRejectAll}
                  style={{ pointerEvents: 'auto' }}
                >
                  Reject All
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreferences(true)}
                  style={{ pointerEvents: 'auto' }}
                >
                  Customize
                </Button>
                <Button 
                  onClick={handleAcceptAll}
                  style={{ pointerEvents: 'auto' }}
                >
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Dialog */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent 
          className="sm:max-w-lg"
          style={{ 
            zIndex: 99999,
            pointerEvents: 'auto'
          }}
        >
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>
              Choose which cookies you want to accept. Necessary cookies are required for the website to function 
              and cannot be disabled. You can change these settings at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h4 className="font-medium mb-1">Necessary Cookies</h4>
                <p className="text-sm text-gray-500">
                  Essential for the website to function properly. These include security, authentication, 
                  and basic functionality cookies.
                </p>
              </div>
              <Switch checked disabled />
            </div>
            
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h4 className="font-medium mb-1">Functional Cookies</h4>
                <p className="text-sm text-gray-500">
                  Enable enhanced features like dark mode preferences, language settings, and 
                  personalized user experience.
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(checked) => setPreferences({ ...preferences, functional: checked })}
              />
            </div>
            
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h4 className="font-medium mb-1">Analytics Cookies</h4>
                <p className="text-sm text-gray-500">
                  Help us understand how visitors use our website through Google Analytics. 
                  This data is anonymized and helps us improve the site.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) => setPreferences({ ...preferences, analytics: checked })}
              />
            </div>
            
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h4 className="font-medium mb-1">Advertising Cookies</h4>
                <p className="text-sm text-gray-500">
                  Used by Google AdSense to show relevant ads and measure ad performance. 
                  These cookies may track you across websites.
                </p>
              </div>
              <Switch
                checked={preferences.advertising}
                onCheckedChange={(checked) => setPreferences({ ...preferences, advertising: checked })}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
            <Button 
              variant="ghost" 
              onClick={() => setShowPreferences(false)}
              style={{ pointerEvents: 'auto' }}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRejectAll}
                style={{ pointerEvents: 'auto' }}
              >
                Reject All
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCustomize}
                style={{ pointerEvents: 'auto' }}
              >
                Save Preferences
              </Button>
              <Button 
                onClick={handleAcceptAll}
                style={{ pointerEvents: 'auto' }}
              >
                Accept All
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
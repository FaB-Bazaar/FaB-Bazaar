"use client"

import { useState, useEffect } from "react"
import { useCookieManager } from "@/lib/cookie-manager"
import { Button } from "@/components/ui/button"

export function CookieUsageExample() {
  const { setCookie, getCookie, deleteCookie, consentOptions } = useCookieManager()
  const [theme, setTheme] = useState<string | null>(null)

  // Load theme preference on mount
  useEffect(() => {
    const savedTheme = getCookie("theme")
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [getCookie])

  const saveThemePreference = (newTheme: string) => {
    // Try to set the cookie - this will only work if user consented to functional cookies
    const success = setCookie("theme", newTheme, "functional", { maxAge: 60 * 60 * 24 * 365 }) // 1 year

    if (success) {
      setTheme(newTheme)
    } else {
      // If cookie setting failed due to lack of consent, we can still use the theme
      // for the current session, but it won't persist
      setTheme(newTheme)
      alert("Your theme preference won't be saved between sessions because you haven't enabled functional cookies.")
    }
  }

  const resetTheme = () => {
    deleteCookie("theme")
    setTheme(null)
  }

  return (
    <div className="p-4 border rounded-md">
      <h3 className="font-medium mb-2">Theme Preference Example</h3>
      <p className="text-sm text-gray-600 mb-4">
        This demonstrates how cookie consent affects functionality. Theme preferences use functional cookies.
      </p>

      <div className="flex gap-2 mb-4">
        <Button variant={theme === "light" ? "default" : "outline"} onClick={() => saveThemePreference("light")}>
          Light Theme
        </Button>
        <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => saveThemePreference("dark")}>
          Dark Theme
        </Button>
        <Button variant="outline" onClick={resetTheme}>
          Reset
        </Button>
      </div>

      <div className="text-sm">
        {theme ? (
          <p>
            Current theme: <strong>{theme}</strong>
          </p>
        ) : (
          <p>No theme preference set</p>
        )}

        <p className="mt-2">
          Functional cookies consent: <strong>{consentOptions.functional ? "Enabled" : "Disabled"}</strong>
        </p>

        {!consentOptions.functional && (
          <p className="text-amber-600 mt-1">
            Enable functional cookies to save your preferences between visits.{" "}
            <button
              onClick={() => document.dispatchEvent(new Event("openCookiePreferences"))}
              className="text-blue-600 hover:underline"
            >
              Update settings
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

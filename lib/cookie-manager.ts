"use client"

import { useCookieConsent } from "@/contexts/CookieConsentContext"

type CookieCategory = "necessary" | "functional" | "analytics" | "advertising"

interface CookieOptions {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date | string
  secure?: boolean
  sameSite?: "strict" | "lax" | "none"
}

// Hook to manage cookies based on consent
export function useCookieManager() {
  const { consentOptions } = useCookieConsent()

  // Set a cookie if the user has consented to the category
  const setCookie = (name: string, value: string, category: CookieCategory, options: CookieOptions = {}) => {
    // Always allow necessary cookies, otherwise check consent
    if (category === "necessary" || consentOptions[category]) {
      const cookieOptions = {
        path: options.path || "/",
        domain: options.domain,
        maxAge: options.maxAge,
        expires: options.expires,
        secure: options.secure !== undefined ? options.secure : process.env.NODE_ENV === "production",
        sameSite: options.sameSite || "lax",
      }

      // Build cookie string
      let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

      if (cookieOptions.path) {
        cookieString += `; path=${cookieOptions.path}`
      }

      if (cookieOptions.domain) {
        cookieString += `; domain=${cookieOptions.domain}`
      }

      if (cookieOptions.maxAge) {
        cookieString += `; max-age=${cookieOptions.maxAge}`
      }

      if (cookieOptions.expires) {
        const expiresValue =
          typeof cookieOptions.expires === "string" ? cookieOptions.expires : cookieOptions.expires.toUTCString()
        cookieString += `; expires=${expiresValue}`
      }

      if (cookieOptions.secure) {
        cookieString += "; secure"
      }

      if (cookieOptions.sameSite) {
        cookieString += `; samesite=${cookieOptions.sameSite}`
      }

      document.cookie = cookieString
      return true
    }

    return false
  }

  // Get a cookie value
  const getCookie = (name: string) => {
    const cookies = document.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.startsWith(name + "=")) {
        return decodeURIComponent(cookie.substring(name.length + 1))
      }
    }
    return null
  }

  // Delete a cookie
  const deleteCookie = (name: string, options: Pick<CookieOptions, "path" | "domain"> = {}) => {
    const cookieOptions = {
      path: options.path || "/",
      domain: options.domain,
      expires: new Date(0), // Set expiration to the past
    }

    setCookie(name, "", "necessary", cookieOptions)
  }

  return {
    setCookie,
    getCookie,
    deleteCookie,
    consentOptions,
  }
}

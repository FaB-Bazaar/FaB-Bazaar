// hooks/use-tcgplayer-affiliate-url.ts
"use client"

import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

// --- Constants ---
const PARTNER_ID = '6477326'
const IMPACT_BASE_URL = 'https://partner.tcgplayer.com/c'
const CAMPAIGN_IDS = '1830156/21018'

// --- Helper Functions to get tracking context ---
function getPageContext(pathname: string): string {
  if (pathname.startsWith('/binder/')) return 'Binder'
  if (pathname === '/wants') return 'Wants'
  if (pathname.startsWith('/heroes/')) return 'Heroes'
  if (pathname.startsWith('/printing/')) return 'PrintingDetails'
  if (pathname === '/browse') return 'Browse'
  return 'Other'
}

function getUserContext(): string {
  if (typeof window === 'undefined') return 'Unknown'
  const hasAuth = !!(localStorage.getItem('auth') || sessionStorage.getItem('session') || document.cookie.includes('session'))
  return hasAuth ? 'LoggedIn' : 'Guest'
}

function getReturnUserContext(): string {
  if (typeof window === 'undefined') return 'Unknown'
  const hasVisited = localStorage.getItem('previousVisit')
  if (!hasVisited) {
    localStorage.setItem('previousVisit', 'true')
    return 'NewUser'
  }
  return 'ReturningUser'
}

function getDeviceContext(): string {
  if (typeof window === 'undefined') return 'Unknown'
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  return isMobile ? 'Mobile' : 'Desktop'
}

/**
 * A custom hook to generate a TCGPlayer affiliate URL with tracking.
 * Falls back to a direct URL if advertising cookies are not consented to.
 * @param baseTcgplayerUrl - The direct TCGPlayer URL for the product.
 * @param feature - Optional context for user action (e.g., 'WantsCard', 'PrintingPage').
 * @returns The fully constructed affiliate URL or the direct URL.
 */
export function useTcgPlayerAffiliateUrl(baseTcgplayerUrl: string, feature?: string) {
  const { consentOptions } = useCookieConsent()
  const pathname = usePathname()

  const affiliateUrl = useMemo(() => {
    if (!baseTcgplayerUrl) return '#'

    // If no advertising consent, use direct link
    if (!consentOptions.advertising) {
      return baseTcgplayerUrl
    }
    
    // Build comprehensive tracking parameters
    const pageContext = getPageContext(pathname)
    const userContext = getUserContext()
    const returnContext = getReturnUserContext()
    const deviceContext = getDeviceContext()
    
    const trackingParams = new URLSearchParams()
    trackingParams.append('subId1', pageContext)
    if (feature) trackingParams.append('subId2', feature)
    trackingParams.append('subId3', userContext)
    trackingParams.append('subId4', returnContext)
    trackingParams.append('subId5', deviceContext)
    
    // The base URL from TCGPlayer already contains tracking, we just need to append our subIds
    const urlWithTracking = `${baseTcgplayerUrl}&${trackingParams.toString()}`
    
    // Construct the final Impact affiliate link
    return `${IMPACT_BASE_URL}/${PARTNER_ID}/${CAMPAIGN_IDS}?u=${encodeURIComponent(urlWithTracking)}`

  }, [baseTcgplayerUrl, consentOptions.advertising, pathname, feature])
  
  return affiliateUrl
}
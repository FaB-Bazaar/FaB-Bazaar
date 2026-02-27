"use client"

import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { usePathname } from 'next/navigation'

interface TcgAffiliateLinkProps {
  tcgplayerUrl: string
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
  target?: string
  rel?: string
  title?: string
  // Optional additional tracking context
  feature?: string
}

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
  
  // Check if user is logged in - adjust this based on your auth implementation
  const hasAuth = localStorage.getItem('auth') || 
                   sessionStorage.getItem('session') ||
                   document.cookie.includes('session')
  return hasAuth ? 'LoggedIn' : 'Guest'
}

function getReturnUserContext(): string {
  if (typeof window === 'undefined') return 'Unknown'
  
  // Check if user has visited before
  const hasVisited = localStorage.getItem('previousVisit')
  if (!hasVisited) {
    localStorage.setItem('previousVisit', 'true')
    return 'NewUser'
  }
  return 'ReturningUser'
}

function getDeviceContext(): string {
  if (typeof window === 'undefined') return 'Unknown'
  
  // Simple mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  return isMobile ? 'Mobile' : 'Desktop'
}

const PARTNER_ID = '6477326'
const IMPACT_BASE_URL = 'https://partner.tcgplayer.com/c'
const CAMPAIGN_IDS = '1830156/21018'

export function TcgAffiliateLink({
  tcgplayerUrl,
  children,
  className,
  onClick,
  target = "_blank",
  rel = "noopener noreferrer",
  title,
  feature
}: TcgAffiliateLinkProps) {
  const { consentOptions } = useCookieConsent()
  const pathname = usePathname()

  // If no advertising consent, use direct link with full privacy protection
  if (!consentOptions.advertising) {
    return (
      <a
        href={tcgplayerUrl}
        className={className}
        onClick={onClick}
        target={target}
        rel={rel} // Use default "noopener noreferrer" for maximum privacy
        title={title}
      >
        {children}
      </a>
    )
  }

  // Build comprehensive tracking parameters
  const pageContext = getPageContext(pathname)
  const userContext = getUserContext()
  const returnContext = getReturnUserContext()
  const deviceContext = getDeviceContext()

  const trackingParams = new URLSearchParams()
  trackingParams.append('subId1', pageContext)      // Page type
  if (feature) trackingParams.append('subId2', feature)  // User action
  trackingParams.append('subId3', userContext)      // LoggedIn/Guest
  trackingParams.append('subId4', returnContext)    // NewUser/ReturningUser
  trackingParams.append('subId5', deviceContext)    // Mobile/Desktop

  const urlWithTracking = `${tcgplayerUrl}&${trackingParams.toString()}`
  const affiliateUrl = `${IMPACT_BASE_URL}/${PARTNER_ID}/${CAMPAIGN_IDS}?u=${encodeURIComponent(urlWithTracking)}`

  return (
    <a
      href={affiliateUrl}
      className={className}
      onClick={onClick}
      target={target}
      rel="noopener" // Allow referrer for affiliate tracking when user has consented
      title={title}
    >
      {children}
    </a>
  )
}
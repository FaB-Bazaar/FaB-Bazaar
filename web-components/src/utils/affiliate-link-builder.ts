/**
 * Affiliate Link Builder - Framework-agnostic utility for building TCGPlayer affiliate links
 * Can be used by any web component or framework
 */

// Type definitions
export interface ConsentOptions {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

export interface TrackingContext {
  pageContext: string;      // subId1: Binder, Wants, Heroes, etc.
  feature: string;          // subId2: Custom feature name
  userContext: string;      // subId3: LoggedIn/Guest
  returnContext: string;    // subId4: NewUser/ReturningUser
  deviceContext: string;    // subId5: Mobile/Desktop
}

export interface AffiliateLinkOptions {
  feature?: string;
  pageContext?: string;
}

// Constants
export const IMPACT_CONFIG = {
  PARTNER_ID: '6477326',
  CAMPAIGN_IDS: '1830156/21018',
  BASE_URL: 'https://partner.tcgplayer.com/c'
} as const;

/**
 * Check cookie consent from localStorage
 * Returns null if no consent data found or parsing fails
 */
export function checkCookieConsent(): ConsentOptions | null {
  if (typeof window === 'undefined') return null;

  try {
    const consentStr = localStorage.getItem('cookieConsentOptions');
    if (!consentStr) return null;

    const consent = JSON.parse(consentStr) as ConsentOptions;
    return consent;
  } catch (error) {
    console.error('Failed to parse cookie consent:', error);
    return null;
  }
}

/**
 * Detect page context from pathname
 * Maps URL patterns to context names for tracking
 */
export function getPageContext(pathname?: string): string {
  if (typeof window === 'undefined') return 'Unknown';

  const path = pathname || window.location.pathname;

  if (path.startsWith('/binder/')) return 'Binder';
  if (path === '/wants') return 'Wants';
  if (path.startsWith('/heroes/')) return 'Heroes';
  if (path.startsWith('/printing/')) return 'PrintingDetails';
  if (path === '/browse') return 'Browse';

  // Default to Article for content pages or Other for everything else
  if (path.startsWith('/article/') || path.includes('/articles/')) return 'Article';

  return 'Other';
}

/**
 * Detect user authentication context
 * Checks for various auth indicators in localStorage/sessionStorage/cookies
 */
export function getUserContext(): string {
  if (typeof window === 'undefined') return 'Unknown';

  // Check various auth indicators
  const hasAuth =
    localStorage.getItem('auth') ||
    sessionStorage.getItem('session') ||
    document.cookie.includes('session');

  return hasAuth ? 'LoggedIn' : 'Guest';
}

/**
 * Detect returning user context
 * Sets localStorage flag on first visit
 */
export function getReturnUserContext(): string {
  if (typeof window === 'undefined') return 'Unknown';

  const hasVisited = localStorage.getItem('previousVisit');
  if (!hasVisited) {
    localStorage.setItem('previousVisit', 'true');
    return 'NewUser';
  }

  return 'ReturningUser';
}

/**
 * Detect device type from user agent
 */
export function getDeviceContext(): string {
  if (typeof window === 'undefined') return 'Unknown';

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  return isMobile ? 'Mobile' : 'Desktop';
}

/**
 * Build tracking context object with all tracking parameters
 */
export function buildTrackingContext(feature: string, options?: AffiliateLinkOptions): TrackingContext {
  return {
    pageContext: options?.pageContext || getPageContext(),
    feature,
    userContext: getUserContext(),
    returnContext: getReturnUserContext(),
    deviceContext: getDeviceContext()
  };
}

/**
 * Build affiliate link with Impact.com tracking
 * Returns direct TCGPlayer URL if no advertising consent given (privacy-first)
 *
 * @param tcgplayerUrl - The original TCGPlayer product URL
 * @param feature - Feature name for tracking (e.g., 'SpotlightCardPurchase')
 * @param options - Optional overrides for tracking context
 * @returns Affiliate URL with tracking, or direct URL if no consent
 */
export function buildTcgAffiliateLink(
  tcgplayerUrl: string,
  feature: string,
  options?: AffiliateLinkOptions
): string {
  // Check consent first
  const consent = checkCookieConsent();

  // If no advertising consent, return direct link (privacy-first approach)
  if (!consent || !consent.advertising) {
    return tcgplayerUrl;
  }

  // Build tracking context
  const context = buildTrackingContext(feature, options);

  // Build tracking parameters
  const trackingParams = new URLSearchParams();
  trackingParams.append('subId1', context.pageContext);
  trackingParams.append('subId2', context.feature);
  trackingParams.append('subId3', context.userContext);
  trackingParams.append('subId4', context.returnContext);
  trackingParams.append('subId5', context.deviceContext);

  // Append tracking params to TCGPlayer URL
  const urlWithTracking = `${tcgplayerUrl}&${trackingParams.toString()}`;

  // Build final affiliate URL
  const affiliateUrl = `${IMPACT_CONFIG.BASE_URL}/${IMPACT_CONFIG.PARTNER_ID}/${IMPACT_CONFIG.CAMPAIGN_IDS}?u=${encodeURIComponent(urlWithTracking)}`;

  return affiliateUrl;
}

/**
 * Check if we should show affiliate link
 * Validates that TCGPlayer URL exists and is in browser environment
 */
export function shouldShowAffiliateLink(tcgplayerUrl?: string): boolean {
  if (!tcgplayerUrl) return false;
  if (typeof window === 'undefined') return false;

  // Could add additional checks here (e.g., geo-restrictions)
  return true;
}

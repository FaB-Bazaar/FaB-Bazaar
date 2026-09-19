export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

function canTrack() {
  return typeof window !== "undefined" && typeof window.gtag === "function"
}

// In-app route history, fed by AnalyticsListener on every page_view. Lets an
// event say which page the visitor came from: the /daily market tier has no
// buy links, its tiles lead to /printing where the click actually happens.
let currentPath: string | null = null
let previousPath: string | null = null

export function recordPageView(path: string) {
  if (path === currentPath) return
  previousPath = currentPath
  currentPath = path
}

export function getPreviousPath(): string | null {
  return previousPath
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!canTrack()) return
  window.gtag("event", name, params ?? {})
}

// GA4 recommended event — keep the name "search" and param "search_term"
export function trackSearch(params: {
  search_term: string
  result_count?: number
  filters?: string[]
}) {
  trackEvent("search", params)
}

// GA4 recommended event — view_item
export function trackViewItem(params: {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price?: number
}) {
  trackEvent("view_item", params)
}

// Custom deck events
export function trackDeckView(params: {
  deck_id: string
  deck_name?: string
  format?: string
  hero?: string
  card_count?: number
  is_public?: boolean
}) {
  trackEvent("deck_view", params)
}

export function trackDeckCreate(params: {
  deck_id?: string
  deck_name?: string
  format?: string
  hero?: string
  is_public?: boolean
}) {
  trackEvent("deck_create", params)
}

export function trackDeckImport(params: {
  deck_id: string
  cards_imported: number
  source?: string
}) {
  trackEvent("deck_import", params)
}

export function trackDeckPresent(params: {
  deck_id: string
  deck_name?: string
  format?: string
  hero?: string
}) {
  trackEvent("deck_present", params)
}

// Custom — a click on a "Buy on TCGplayer" link. Fired by TcgAffiliateLink for
// every surface; `page_context`/`feature` mirror the Impact subId1/subId2 values,
// `affiliate` is false when the visitor withheld advertising consent (the click
// went to a plain TCGplayer link with no partner attribution).
export function trackAffiliateClick(params: {
  page_context: string
  feature: string
  page_path: string
  destination: string
  affiliate: boolean
}) {
  trackEvent("affiliate_click", { ...params, previous_page_path: getPreviousPath() ?? "none" })
}

// GA4 recommended event — login
export function trackLogin(method: string) {
  trackEvent("login", { method })
}

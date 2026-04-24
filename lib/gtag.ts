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

// GA4 recommended event — login
export function trackLogin(method: string) {
  trackEvent("login", { method })
}

import { useCookieConsent } from '@/contexts/CookieConsentContext'
// Google Analytics utility functions
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    // The consent context handles this via Google Consent Mode
    // But you could add an additional check here if needed
    window.gtag('config', GA_TRACKING_ID!, {
      page_location: url,
    })
  }
}


// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: {
  action: string
  category: string
  label: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Declare gtag on window object
declare global {
  interface Window {
    gtag: (...args: any[]) => void
  }
} 
//contexts/CookieConsentContext.tsx
"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { usePathname } from 'next/navigation'

// Define window.gtag for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
    adsbygoogle: any[]
    impactStat: (...args: any[]) => void
  }
}

type ConsentOptions = {
  necessary: boolean
  functional: boolean
  analytics: boolean
  advertising: boolean
}

type CookieConsentContextType = {
  consentGiven: boolean
  consentOptions: ConsentOptions
  acceptAll: () => void
  rejectAll: () => void  // Add this line
  customizeConsent: (options: ConsentOptions) => void
  openPreferences: () => void
  showPreferences: boolean
  setShowPreferences: (show: boolean) => void
}

// GDPR Compliant defaults - privacy-first approach
const defaultConsentOptions: ConsentOptions = {
  necessary: true,   // Always required
  functional: false, // User must opt-in
  analytics: false,  // User must opt-in
  advertising: false, // User must opt-in
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined)

// Load Google Analytics script dynamically after consent
function loadGoogleAnalytics() {
  if (typeof window === "undefined" || document.querySelector('#gtag-script')) return

  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId) {
    console.warn("Google Analytics ID not found.");
    return;
  }

  const script = document.createElement('script')
  script.id = 'gtag-script'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)

  script.onload = () => {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', gaId)
  }
}

// Load AdSense script dynamically after consent
function loadAdSense() {
  if (typeof window === "undefined" || document.querySelector('#adsense-script')) return

  const script = document.createElement('script')
  script.id = 'adsense-script'
  script.async = true
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8256117741560128'
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

// Load Impact tracking script dynamically after advertising consent
function loadImpactTracking() {
  if (typeof window === "undefined" || document.querySelector('#impact-script') || window.impactStat) return

  // Use Impact's exact STAT tag implementation
  (function(i,m,p,a,c,t){
    c.ire_o=p;
    c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};
    t=a.createElement(m);
    var z=a.getElementsByTagName(m)[0];
    t.async=1;
    t.src=i;
    t.id='impact-script'; // Add ID for tracking
    z.parentNode.insertBefore(t,z)
  })('https://utt.impactcdn.com/P-A6477326-dc9d-49e9-9f04-0f0248ed0fc01.js','script','impactStat',document,window);
  
  window.impactStat('transformLinks');
  window.impactStat('trackImpression');
}

// Update Google's consent based on user preferences
function updateGoogleConsent(options: ConsentOptions) {
  if (typeof window === "undefined" || !window.gtag) return

  window.gtag("consent", "update", {
    ad_storage: options.advertising ? "granted" : "denied",
    analytics_storage: options.analytics ? "granted" : "denied",
    functionality_storage: options.functional ? "granted" : "denied",
    personalization_storage: options.functional ? "granted" : "denied",
    ad_user_data: options.advertising ? "granted" : "denied",
    ad_personalization: options.advertising ? "granted" : "denied",
  })
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consentGiven, setConsentGiven] = useState(false)
  const [consentOptions, setConsentOptions] = useState<ConsentOptions>(defaultConsentOptions)
  const [showPreferences, setShowPreferences] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)

  const pathname = usePathname()

  // --- 1. CUSTOMIZE THIS LIST ---
  // Define the list of page paths where you WANT ads and analytics to run.
  // Using .startsWith() allows you to include all sub-pages, like /cards/details/123.
  const includedPaths = [
    '/',
    '/profile/',
    '/binder',
    '/wants',
    '/search',
  ];

  // Load consent from localStorage on component mount
  useEffect(() => {
    if (typeof window === "undefined") return

    const savedConsent = localStorage.getItem("cookieConsent")
    const savedOptions = localStorage.getItem("cookieConsentOptions")

    if (savedConsent === "true" && savedOptions) {
      setConsentGiven(true)
      try {
        const parsedOptions = JSON.parse(savedOptions) as ConsentOptions
        setConsentOptions(parsedOptions)
        updateGoogleConsent(parsedOptions)
      } catch (e) {
        console.error("Error parsing saved cookie consent options", e)
      }
    }
  }, [])

  // --- 2. THE CORE LOGIC ---
  // This effect runs when consent changes OR when the user navigates to a new page.
  useEffect(() => {
    const isOnIncludedPath = includedPaths.some(path => pathname.startsWith(path));

    // EXIT EARLY if any of these conditions are true:
    // 1. User has not given consent.
    // 2. Scripts have already been loaded for this session.
    // 3. The current page is NOT on our "allow list".
    if (!consentGiven || scriptsLoaded || !isOnIncludedPath) {
      return;
    }

    // If all checks pass, load the scripts according to consent preferences.
    if (consentOptions.analytics) {
      loadGoogleAnalytics()
    }
    if (consentOptions.advertising) {
      loadAdSense()
      loadImpactTracking() // Load Impact tracking when advertising consent is granted
    }
    
    // Mark scripts as loaded to prevent this from running again on subsequent page navigations.
    setScriptsLoaded(true)

  }, [consentGiven, consentOptions, scriptsLoaded, pathname]) // Re-run when path or consent changes

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      functional: true,
      analytics: true,
      advertising: true,
    }
    setConsentOptions(allAccepted)
    setConsentGiven(true)
    localStorage.setItem("cookieConsent", "true")
    localStorage.setItem("cookieConsentOptions", JSON.stringify(allAccepted))
    updateGoogleConsent(allAccepted)
  }

  const rejectAll = () => {
  const allRejected = {
    necessary: true,    // Always required
    functional: false,
    analytics: false,
    advertising: false,
  }
  setConsentOptions(allRejected)
  setConsentGiven(true)  // Important: User has made a choice, so hide banner
  localStorage.setItem("cookieConsent", "true")
  localStorage.setItem("cookieConsentOptions", JSON.stringify(allRejected))
  updateGoogleConsent(allRejected)
}

  const customizeConsent = (options: ConsentOptions) => {
    const updatedOptions = { ...options, necessary: true }
    setConsentOptions(updatedOptions)
    setConsentGiven(true)
    localStorage.setItem("cookieConsent", "true")
    localStorage.setItem("cookieConsentOptions", JSON.stringify(updatedOptions))
    updateGoogleConsent(updatedOptions)
  }

  const openPreferences = () => {
    setShowPreferences(true)
  }

  return (
  <CookieConsentContext.Provider
    value={{
      consentGiven,
      consentOptions,
      acceptAll,
      rejectAll,  // Add this line
      customizeConsent,
      openPreferences,
      showPreferences,
      setShowPreferences,
    }}
  >
    {children}
  </CookieConsentContext.Provider>
)
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext)
  if (context === undefined) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider")
  }
  return context
}
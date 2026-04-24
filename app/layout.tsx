import type React from "react"
import type { Metadata } from "next"
import { Outfit } from "next/font/google"

const OutfitFont = Outfit({ subsets: ["latin"] })
import Script from "next/script"
import "./globals.css"
import Navbar from "@/components/navbar"
import { AuthProvider } from "@/contexts/AuthContext"
import { AuthSessionProvider } from "@/components/auth-provider"
import { CookieConsentProvider } from "@/contexts/CookieConsentContext"
import { CookieConsentBanner } from "@/components/cookie/cookie-consent-banner"
import { CookieSettingsButton } from "@/components/cookie/cookie-settings-button"
import { DarkModeProvider } from '@/contexts/DarkModeContext'
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Toaster } from "@/components/ui/toaster"
import { AdsConfigProvider } from "@/contexts/AdsConfigContext"
import { getAdsEnabled } from "@/app/actions/siteSettingsActions"
import { AnalyticsListener } from "@/components/analytics/AnalyticsListener"
import { Suspense } from "react"



// Your metadata object is perfect and remains unchanged.
export const metadata: Metadata = {
  title: {
    default: "FaB Bazaar - The Ultimate Flesh and Blood Trading Platform",
    template: "%s | FaB Bazaar"
  },
  description: "Trade Flesh and Blood cards with other collectors. Browse cards, manage binders, create wants lists, and find local trading partners. Fully integrated with Discord and Claude MCP. Join the FaB trading community with Discord OAuth authentication.",
  keywords: [
    "Flesh and Blood", "FaB", "trading cards", "card trading", "TCG",
    "trading platform", "card collection", "local trading", "Legend Story Studios",
    "card game", "trading community", "binder management", "wants list",
    "MCP", "Claude", "Discord OAuth", "cold foil cards", "legendary cards",
    "card database", "trade matching", "local stores"
  ],
  authors: [{ name: "FaB Bazaar Team" }],
  creator: "FaB Bazaar",
  publisher: "FaB Bazaar",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://fabbazaar.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://fabbazaar.app',
    title: 'FaB Bazaar - The Ultimate Flesh and Blood Trading Platform',
    description: 'Trade Flesh and Blood cards with other collectors. Browse cards, manage binders, create wants lists, and find local trading partners. Fully integrated with Discord and Claude MCP.',
    siteName: 'FaB Bazaar',
    images: [
      {
        url: '/icon-512x512.png', // Optimal size for Discord/social media
        width: 512,
        height: 512,
        alt: 'FaB Bazaar Trading Platform',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'FaB Bazaar - The Ultimate Flesh and Blood Trading Platform',
    description: 'Trade Flesh and Blood cards with other collectors. Browse cards, manage binders, create wants lists, and find local trading partners.',
    images: ['/icon-512x512.png'], // Optimal size for social media
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'bc7f6d8de776b7f1',
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    other: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  generator: 'Next.js'
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adsEnabled = await getAdsEnabled();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('darkMode');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  
                  if (stored === 'true' || (stored === null && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        
        {/* Google Consent Mode Initialization - GDPR Compliant */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'analytics_storage': 'denied',
                'functionality_storage': 'denied',
                'personalization_storage': 'denied',
                'security_storage': 'granted'
              });
            `,
          }}
        />

        {/* Note: Impact tracking will be loaded via CookieConsentProvider when advertising consent is granted */}
        
        {/* Structured Data for Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "FaB Bazaar",
              "url": "https://fabbazaar.app",
              "logo": "https://fabbazaar.app/icon-512x512.png", // Updated to use new icon
              "description": "The Ultimate Flesh and Blood Trading Platform",
              "sameAs": [],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "availableLanguage": "English"
              }
            })
          }}
        />
        
        {/* Structured Data for Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "FaB Bazaar",
              "url": "https://fabbazaar.app",
              "description": "Trade Flesh and Blood cards with other collectors",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://fabbazaar.app/browse?search={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />

      </head>
      <body className={cn(
        "min-h-screen font-sans antialiased bg-page",
        OutfitFont.className
      )}>
        <AdsConfigProvider adsEnabled={adsEnabled}>
        <DarkModeProvider>
          <CookieConsentProvider>
            <AuthSessionProvider>
              <AuthProvider>
                <Suspense fallback={null}>
                  <AnalyticsListener />
                </Suspense>
                <div className="relative flex flex-col min-h-screen">
                  
                  <header className="sticky top-0 z-50">
                    <Navbar />
                  </header>
                  
                  <main className="flex-grow">
                    {children}
                  </main>

<footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
  <div className="container mx-auto px-6 py-12">
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
      
      {/* Column 1: Brand & Disclaimer */}
      <div className="col-span-1 lg:col-span-2">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">FaB Bazaar</h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          The ultimate fan-made trading platform for the Flesh and Blood TCG community.
          Find cards, manage your collection, and connect with local traders. 
        </p>
      </div>

      {/* Column 2: Navigate */}
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Navigate</h4>
        <ul className="mt-4 space-y-3 text-sm">
          <li>
            <Link href="/collection" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Collection
            </Link>
          </li>
          <li>
            <Link href="/browse" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Bulk Import
            </Link>
          </li>
          <li>
            <Link href="/decks" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Decks
            </Link>
          </li>
          <li>
            <Link href="/guides" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Articles
            </Link>
          </li>
          <li>
            <Link
              href="https://github.com/FaB-Bazaar/FaB-Bazaar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors"
            >
              Source Code
            </Link>
          </li>
        </ul>
      </div>

      {/* Column 3: Resources */}
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Resources</h4>
        <ul className="mt-4 space-y-3 text-sm">
          <li>
            <Link href="/terms-of-service" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link href="/privacy-policy" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/about" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
              About
            </Link>
          </li>
          {/* The CookieSettingsButton is a component, not a link */}
          <li>
            <CookieSettingsButton />
          </li>
        </ul>
      </div>

    </div>

    {/* Bottom Bar for Copyright */}
    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
        &copy; {new Date().getFullYear()} FaB Bazaar is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios.
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Some card links may earn us a commission at no extra cost to you.
      </p>
    </div>
  </div>
</footer>

                  {/* Place the banner and dialogs here, outside the main flow,
                      ensuring they render on top due to their fixed positioning and z-index. */}
                  <CookieConsentBanner />
                  <Toaster />
                </div>
              </AuthProvider>
            </AuthSessionProvider>
          </CookieConsentProvider>
        </DarkModeProvider>
        </AdsConfigProvider>

        {/* Web Components - Load after DOM is ready */}
        <Script
          src="/wc/fabbazaar-ui.js"
          strategy="afterInteractive"
          type="module"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}

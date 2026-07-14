import type React from "react"
import type { Metadata, Viewport } from "next"
import { Outfit } from "next/font/google"

const OutfitFont = Outfit({ subsets: ["latin"] })
import Script from "next/script"
import "./globals.css"
import Navbar from "@/components/navbar"
import { AuthProvider } from "@/contexts/AuthContext"
import { AuthSessionProvider } from "@/components/auth-provider"
import { CookieConsentProvider } from "@/contexts/CookieConsentContext"
import { CookieConsentBanner } from "@/components/cookie/cookie-consent-banner"
import { SiteFooter } from "@/components/site-footer"
import { DarkModeProvider } from '@/contexts/DarkModeContext'
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import { AnalyticsListener } from "@/components/analytics/AnalyticsListener"
import { Suspense } from "react"



// interactiveWidget: on Android the on-screen keyboard shrinks the layout
// viewport instead of overlaying it, so dvh-sized shells (Volzar chat) compact
// and the composer stays visible while typing. iOS ignores this key.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
}

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
        "min-h-dvh font-sans antialiased bg-page",
        OutfitFont.className
      )}>
        <DarkModeProvider>
          <CookieConsentProvider>
            <AuthSessionProvider>
              <AuthProvider>
                <Suspense fallback={null}>
                  <AnalyticsListener />
                </Suspense>
                {/* pb-14 reserves space for the mobile bottom tab bar (sm:hidden) so
                    it never covers the footer / page content. min-h-DVH, not
                    -screen: 100vh is iOS's LARGE viewport (URL bar collapsed),
                    but inner shells (Volzar) size in dvh — the mismatch used to
                    stretch main.flex-grow into a dead band between the chat
                    composer and the footer whenever Safari's bar was visible. */}
                <div className="relative flex flex-col min-h-dvh pb-14 sm:pb-0">
                  
                  <header className="sticky top-0 z-50">
                    <Navbar />
                  </header>
                  
                  <main className="flex-grow">
                    {children}
                  </main>

                  <SiteFooter />

                  {/* Place the banner and dialogs here, outside the main flow,
                      ensuring they render on top due to their fixed positioning and z-index. */}
                  <CookieConsentBanner />
                  <Toaster />
                </div>
              </AuthProvider>
            </AuthSessionProvider>
          </CookieConsentProvider>
        </DarkModeProvider>

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

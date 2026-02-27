'use client'

import { useEffect } from 'react'
import { generatePageSchemas } from '@/lib/structured-data'

interface StructuredDataProps {
  pageType: string
  data?: any
}

export default function StructuredData({ pageType, data }: StructuredDataProps) {
  useEffect(() => {
    // Remove any existing structured data scripts
    const existingScripts = document.querySelectorAll('script[data-structured-data]')
    existingScripts.forEach(script => script.remove())

    // Generate schemas for this page
    const schemas = generatePageSchemas(pageType, data)

    // Inject each schema as a script tag
    schemas.forEach((schema, index) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-structured-data', 'true')
      script.textContent = JSON.stringify(schema, null, 2)
      document.head.appendChild(script)
    })

    // Cleanup function
    return () => {
      const scripts = document.querySelectorAll('script[data-structured-data]')
      scripts.forEach(script => script.remove())
    }
  }, [pageType, data])

  // This component doesn't render anything visible
  return null
}

// Convenience components for specific page types
export function CardStructuredData({ card }: { card: any }) {
  return <StructuredData pageType="card" data={card} />
}

export function BinderStructuredData({ binder }: { binder: any }) {
  return <StructuredData pageType="binder" data={binder} />
}

export function WantsListStructuredData({ wantsList }: { wantsList: any }) {
  return <StructuredData pageType="wants" data={wantsList} />
}

export function ListingStructuredData({ listing }: { listing: any }) {
  return <StructuredData pageType="listing" data={listing} />
}

export function GameStoreStructuredData({ store }: { store: any }) {
  return <StructuredData pageType="store" data={store} />
}

export function ArticleStructuredData({ article }: { article: any }) {
  return <StructuredData pageType="article" data={article} />
}

export function EventStructuredData({ event }: { event: any }) {
  return <StructuredData pageType="event" data={event} />
} 
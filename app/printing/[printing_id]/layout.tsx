// app/printing/[printing_id]/layout.tsx
import type { Metadata } from "next"

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ printing_id: string }> 
}): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    // Fetch printing data for metadata
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app'}/api/printings/search?printingIds=${encodeURIComponent(resolvedParams.printing_id)}&show=summary&limit=1`)
    
    if (response.ok) {
      const data = await response.json()
      const printing = data.success && data.data.printings?.[0]
      
      if (printing) {
        const cardName = printing.display_name || printing.name
        const setName = printing.set?.toUpperCase() || 'Unknown Set'
        
        return {
          title: `${cardName} (${setName}) - Card Details | FaB Bazaar`,
          description: `View detailed information for ${cardName} from ${setName}. Check pricing, stats, ownership data, and add to your wants list or collection.`,
          keywords: [
            cardName,
            setName,
            "FaB card details",
            "flesh and blood card",
            "TCG card info",
            "card pricing",
            "card stats",
            "wants list",
            "collection management"
          ],
          openGraph: {
            title: `${cardName} (${setName}) | FaB Bazaar`,
            description: `Detailed card information for ${cardName} including pricing, stats, and ownership data.`,
            url: `/printing/${resolvedParams.printing_id}`,
            images: printing.image_url ? [
              {
                url: printing.image_url,
                width: 400,
                height: 560,
                alt: cardName,
              }
            ] : undefined,
          },
          twitter: {
            card: 'summary',
            title: `${cardName} (${setName}) | FaB Bazaar`,
            description: `Detailed card information for ${cardName} including pricing, stats, and ownership data.`,
            images: printing.image_url ? [printing.image_url] : undefined,
          },
          alternates: {
            canonical: `/printing/${resolvedParams.printing_id}`,
          },
        }
      }
    }
  } catch (error) {
    console.error('Error generating metadata for printing:', error)
  }

  // Fallback metadata
  return {
    title: "Card Details | FaB Bazaar",
    description: "View detailed information for this Flesh and Blood card including pricing, stats, and ownership data.",
    keywords: [
      "FaB card details",
      "flesh and blood card",
      "TCG card info",
      "card pricing",
      "card collection"
    ],
    openGraph: {
      title: "Card Details | FaB Bazaar",
      description: "Detailed card information including pricing, stats, and ownership data.",
      url: `/printing/${resolvedParams.printing_id}`,
    },
    alternates: {
      canonical: `/printing/${resolvedParams.printing_id}`,
    },
  }
}

export default function PrintingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
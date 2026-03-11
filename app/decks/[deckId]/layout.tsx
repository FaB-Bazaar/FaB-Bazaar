import type { Metadata } from "next"
import { deckService, userService } from "@/lib/services"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ deckId: string }>
}): Promise<Metadata> {
  const { deckId } = await params

  try {
    const result = await deckService.findByPublicId(deckId)

    if (result.success && result.data && result.data.isPublic) {
      const deck = result.data

      // Fetch owner username
      let ownerName: string | undefined
      try {
        const userResult = await userService.findById(deck.userId)
        if (userResult.success && userResult.data) {
          ownerName = userResult.data.username
        }
      } catch {
        // owner name is optional
      }

      const heroCard = deck.hero?.[0]?.printingDetails
      const heroImageUrl = heroCard?.image_url
      const format = deck.format?.toUpperCase() ?? "CC"
      const heroName =
        deck.heroName ||
        heroCard?.display_name ||
        heroCard?.name ||
        null
      const cardCount = deck.totalCards ?? 0

      const title = ownerName
        ? `${deck.name} by ${ownerName} | FaB Bazaar`
        : `${deck.name} | FaB Bazaar`

      const description = [
        format,
        heroName ?? "No Hero",
        `${cardCount} cards`,
      ].join(" · ")

      return {
        title,
        description,
        openGraph: {
          title: ownerName ? `${deck.name} by ${ownerName}` : deck.name,
          description,
          url: `/decks/${deckId}`,
          images: heroImageUrl
            ? [{ url: heroImageUrl, width: 400, height: 560, alt: heroName }]
            : undefined,
        },
        twitter: {
          card: "summary",
          title: ownerName ? `${deck.name} by ${ownerName}` : deck.name,
          description,
          images: heroImageUrl ? [heroImageUrl] : undefined,
        },
        alternates: {
          canonical: `/decks/${deckId}`,
        },
      }
    }
  } catch {
    // fall through to default
  }

  return {
    title: "Deck | FaB Bazaar",
    description: "View this Flesh and Blood deck on FaB Bazaar.",
    twitter: {
      card: "summary",
    },
  }
}

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

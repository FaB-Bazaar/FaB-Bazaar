import type { Metadata } from "next"
import { userService, wantsService } from "@/lib/services"
import { displayUsername } from "@/lib/utils/display-username"

const BASE_URL = process.env.NEXTAUTH_URL || "https://fabbazaar.app"
const FALLBACK_IMAGE = `${BASE_URL}/icon-512x512.png`

export async function generateMetadata(
  { params }: { params: Promise<{ userId: string }> }
): Promise<Metadata> {
  const { userId } = await params

  const fallback: Metadata = {
    title: "Wants List - FaB Bazaar",
    description:
      "Browse a Flesh and Blood wants list on FaB Bazaar. Have a match in your binder? Start a trade.",
  }

  try {
    const userResult = await userService.getBasicInfo(userId)
    if (!userResult.success || !userResult.data) return fallback

    const rawName = userResult.data.username || userResult.data.discordUsername || "User"
    const ownerName = displayUsername(rawName)

    const wantsResult = await wantsService.getUserWants(userId, undefined, { limit: 1000 })
    const items = wantsResult.success ? wantsResult.data.items : []
    const total = wantsResult.success ? wantsResult.data.total ?? items.length : 0

    const byPrice = [...items].sort((a, b) => (b.tcg_low || 0) - (a.tcg_low || 0))
    const topNames = byPrice
      .slice(0, 3)
      .map((item) => item.display_name || item.name)
      .filter(Boolean)

    const title = `${ownerName}'s Wants List`
    const description =
      total > 0
        ? `${ownerName} is looking for ${total} card${total === 1 ? "" : "s"} on FaB Bazaar${
            topNames.length ? `, including ${topNames.join(", ")}` : ""
          }. Have a match in your binder? Start a trade.`
        : `${ownerName}'s Flesh and Blood wants list on FaB Bazaar. Have a match in your binder? Start a trade.`

    const url = `${BASE_URL}/wants/${userId}`
    const ogImage = byPrice[0]?.image_url || FALLBACK_IMAGE

    return {
      title,
      description,
      openGraph: {
        title: `${title} | FaB Bazaar`,
        description,
        url,
        images: [{ url: ogImage, alt: title }],
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: [ogImage],
      },
      alternates: {
        canonical: url,
      },
    }
  } catch (error) {
    console.error("[Wants Metadata] Error generating metadata:", error)
    return fallback
  }
}

export default function SharedWantsLayout({ children }: { children: React.ReactNode }) {
  return children
}

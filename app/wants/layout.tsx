//app/layout.tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wants List - Cards You're Looking For",
  description: "Manage your Flesh and Blood wants list. Track cards you're looking to trade for. Share your wants list with other traders and find matches. Set priorities and prices for wanted cards.",
  keywords: [
    "FaB wants list",
    "cards wanted",
    "trading wants",
    "card wishlist",
    "trade matches",
    "card hunting",
    "trading community"
  ],
  openGraph: {
    title: "Wants List - Cards You're Looking For | FaB Bazaar",
    description: "Manage your Flesh and Blood wants list. Track cards you're looking to trade for.",
    url: "/wants",
  },
  alternates: {
    canonical: "/wants",
  },
}

export default function WantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
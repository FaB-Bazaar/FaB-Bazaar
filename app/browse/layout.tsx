import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Browse Cards - Add to Collection & Wants",
  description: "Search and browse Flesh and Blood cards. Add cards to your collection or wants list. Import from Fabrary, Cardlist, or FaBTCG. Find rare cards, cold foils, legendary cards, and more. Filter by set, rarity, and type.",
  keywords: [
    "Flesh and Blood cards",
    "FaB card search",
    "card collection",
    "wants list",
    "card import",
    "Fabrary import",
    "cold foil cards",
    "legendary cards",
    "card database"
  ],
  openGraph: {
    title: "Browse Cards - Add to Collection & Wants | FaB Bazaar",
    description: "Search and browse Flesh and Blood cards. Add cards to your collection or wants list.",
    url: "/browse",
  },
  alternates: {
    canonical: "/browse",
  },
}

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
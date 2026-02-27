import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Deck Manager - Build and Organize FaB Decks",
  description: "Create, manage, and organize your Flesh and Blood decks. Build competitive decks with our deck builder, track estimated values, and share with the community.",
  keywords: [
    "FaB deck builder",
    "deck manager",
    "flesh and blood decks",
    "competitive decks",
    "deck building",
    "deck organization",
    "TCG deck builder",
    "deck analysis",
    "deck statistics"
  ],
  openGraph: {
    title: "Deck Manager - Build and Organize FaB Decks | FaB Bazaar",
    description: "Create, manage, and organize your Flesh and Blood decks with our comprehensive deck builder.",
    url: "/decks",
  },
  alternates: {
    canonical: "/decks",
  },
}

export default function DecksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
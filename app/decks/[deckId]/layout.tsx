import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Deck Builder - Advanced FaB Deck Construction",
  description: "Advanced deck building interface for Flesh and Blood. Add cards, analyze deck composition, compare with collection, and export decklists with drag-and-drop functionality.",
  keywords: [
    "FaB deck builder",
    "deck construction",
    "deck editor",
    "card selection",
    "deck analysis",
    "deck statistics",
    "collection comparison",
    "deck export",
    "sideboard management"
  ],
  openGraph: {
    title: "Deck Builder - Advanced FaB Deck Construction | FaB Bazaar",
    description: "Advanced deck building interface with drag-and-drop, analysis, and collection integration.",
    url: "/decks/builder",
  },
  alternates: {
    canonical: "/decks/builder",
  },
}

export default function DeckBuilderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
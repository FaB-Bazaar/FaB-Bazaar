import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Community Decks - Browse Public FaB Decks",
  description: "Browse public Flesh and Blood decks shared by the community. Find competitive decklists, copy them to your collection, and start building.",
  openGraph: {
    title: "Community Decks - Browse Public FaB Decks | FaB Bazaar",
    description: "Browse public Flesh and Blood decks shared by the community. Find competitive decklists and copy them to your collection.",
    url: "/decks/community",
  },
  alternates: {
    canonical: "/decks/community",
  },
}

export default function CommunityDecksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

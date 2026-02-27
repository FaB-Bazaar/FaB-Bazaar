import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Advanced Card Search - Powerful FaB Database Query Tools",
  description: "Advanced search for Flesh and Blood cards with shorthand syntax, boolean filters, price ranges, set selection, and bulk operations. Search by stats, keywords, talents, classes, and more with powerful query capabilities.",
  keywords: [
    "FaB advanced search",
    "card database query",
    "shorthand syntax",
    "boolean filters",
    "bulk card operations",
    "trading card search",
    "query builder",
    "card stats search",
    "price range filters",
    "set filters",
    "rarity search",
    "foiling search",
    "talent search",
    "class search"
  ],
  openGraph: {
    title: "Advanced Card Search - Powerful FaB Database Query Tools | FaB Bazaar",
    description: "Advanced search for Flesh and Blood cards with shorthand syntax, boolean filters, and bulk operations.",
    url: "/search",
  },
  alternates: {
    canonical: "/search",
  },
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your Collection - Manage FaB Cards",
  description: "Manage your Flesh and Blood card collection. View binders, organize cards, and track your inventory. Export your collection and share with other traders. Create multiple binders for different purposes.",
  keywords: [
    "FaB collection",
    "card binders",
    "collection management",
    "card inventory",
    "binder organization",
    "collection export",
    "trading cards"
  ],
  openGraph: {
    title: "Your Collection - Manage FaB Cards | FaB Bazaar",
    description: "Manage your Flesh and Blood card collection. View binders, organize cards, and track your inventory.",
    url: "/collection",
  },
  alternates: {
    canonical: "/collection",
  },
}

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
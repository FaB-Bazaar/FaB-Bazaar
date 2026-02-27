import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Discord Bot - FaB Bazaar",
  description: "Manage your Flesh and Blood collection from Discord. Search cards, track trades, and find trading partners with the FaB Bazaar bot.",
  keywords: [
    "FaB Bazaar Discord",
    "Discord bot",
    "Flesh and Blood Discord",
    "trading card Discord bot",
    "FaB collection management",
    "Discord integration"
  ],
  openGraph: {
    title: "Discord Bot | FaB Bazaar",
    description: "Search cards, manage your collection, and find trades - all from Discord",
    url: "/discord",
  },
  alternates: {
    canonical: "/discord",
  },
}

export default function DiscordLayout({ children }: { children: React.ReactNode }) {
  return children
}

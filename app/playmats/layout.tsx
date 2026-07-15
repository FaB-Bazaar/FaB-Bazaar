import type { Metadata } from "next"

const OG_IMAGE = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/playmat-enlightened-strike-2019/public"

export const metadata: Metadata = {
  title: "Playmats - Every Official FaB Playmat",
  description:
    "Every official Flesh and Blood playmat in one place — where it came from, who made it, and which ones you have or want. Track your playmat collection on FaB Bazaar.",
  keywords: [
    "FaB playmats",
    "flesh and blood playmats",
    "playmat database",
    "LSS playmats",
    "playmat collection",
    "armory kit playmat",
    "judge playmat",
    "TCG playmats",
  ],
  openGraph: {
    title: "Playmats - Every Official FaB Playmat | FaB Bazaar",
    description:
      "Every official Flesh and Blood playmat in one place — where it came from, who made it, and which ones you have or want.",
    url: "/playmats",
    images: [
      {
        url: OG_IMAGE,
        alt: "Enlightened Strike judge playmat — the most sought-after Flesh and Blood playmat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playmats - Every Official FaB Playmat | FaB Bazaar",
    description:
      "Every official Flesh and Blood playmat in one place — track which ones you have and want.",
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: "/playmats",
  },
}

export default function PlaymatsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

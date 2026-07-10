import type { Metadata } from "next"

const BASE_URL = process.env.NEXTAUTH_URL || "https://fabbazaar.app"

const TITLE = "Volzar — AI Chat for Flesh and Blood"
const DESCRIPTION =
  "Chat with Volzar, FaB Bazaar's AI assistant. Search cards, drill into your binders and decks, compare your collection to the Decks to Beat, and get trade help — all in one conversation."

// Anonymous visitors (including Discord's link crawler) must receive real HTML
// with these tags — the page renders a signed-out gate instead of redirecting
// to login, or link embeds would show the generic site card.
export const metadata: Metadata = {
  // Root layout's title template appends "| FaB Bazaar"
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/volzar`,
    images: [{ url: `${BASE_URL}/volzar-icon.png`, width: 512, height: 512, alt: "Volzar" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/volzar-icon.png`],
  },
  alternates: {
    canonical: `${BASE_URL}/volzar`,
  },
}

export default function VolzarLayout({ children }: { children: React.ReactNode }) {
  return children
}

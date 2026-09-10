import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Scan Cards - Add Cards to Your Collection by Photo",
  description:
    "Point your phone at a Flesh and Blood card and add it to your FaB Bazaar binder. Photo recognition finds the card; you pick the exact printing and foiling.",
  keywords: ["FaB card scanner", "scan flesh and blood cards", "card recognition", "collection import", "binder import"],
  openGraph: {
    title: "Scan Cards - Add Cards to Your Collection by Photo | FaB Bazaar",
    description: "Photograph a card, pick the printing, it lands in your binder.",
    url: "/scan",
  },
  alternates: { canonical: "/scan" },
  robots: { index: false },
}

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children
}

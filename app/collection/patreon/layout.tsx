// app/collection/patreon/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pro Inventory - Advanced Collection Management",
  description: "Manage your itemized Flesh and Blood card inventory with premium, ad-free tools for Patreon supporters. Track individual copies, conditions, acquisition prices, and more.",
  keywords: [
    "FaB inventory",
    "card inventory management",
    "pro collection",
    "Patreon feature",
    "ad-free", // Add "ad-free" as a keyword
    "card tracking",
    "graded cards",
    "collection value",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Pro Inventory (Ad-Free) | FaB Bazaar",
    description: "Manage your itemized Flesh and Blood card inventory with premium, ad-free tools for supporters.",
    url: "/collection/patreon",
  },
};

export default function PatreonCollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
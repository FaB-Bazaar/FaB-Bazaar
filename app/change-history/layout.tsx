import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Change history",
  description: "Cards you moved between your binders in the last 30 days.",
  robots: { index: false, follow: false },
}

export default function ChangeHistoryLayout({ children }: { children: React.ReactNode }) {
  return children
}

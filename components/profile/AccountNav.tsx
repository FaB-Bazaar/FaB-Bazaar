"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Pencil, Link2, ExternalLink, Share2 } from "lucide-react"
import { accountNavItems } from "@/lib/profile/account-nav"
import { useAuth } from "@/contexts/AuthContext"

const ICONS: Record<string, typeof User> = {
  "Account": User,
  "Edit profile": Pencil,
  "Socials": Share2,
  "Connected accounts": Link2,
  "Public profile": ExternalLink,
}

// Side nav for the account pages: a vertical list on desktop, a scrollable
// row above the content on phones.
//
// `username` (for the Public profile link) defaults to the signed-in user's;
// pages that have already loaded the profile can pass it.
export function AccountNav({ username }: { username?: string }) {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()
  const items = accountNavItems(username || user?.username || "", pathname)

  return (
    <nav aria-label="Account" className="md:w-52 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible md:sticky md:top-24">
        {items.map((item) => {
          const Icon = ICONS[item.label] ?? User
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  item.active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

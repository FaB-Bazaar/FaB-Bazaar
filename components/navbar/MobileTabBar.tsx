"use client"

/**
 * Mobile-only bottom tab bar (sm:hidden). Three tabs:
 *   • Search     → navigates straight to /opt
 *   • Collection → opens a bottom sheet of quick links + pinned/recent binders
 *   • Decks      → opens a bottom sheet of quick links + pinned/recent decks
 *
 * Collection/Decks mirror the desktop navbar dropdowns. The binder/deck data
 * and the on-demand loaders live in <Navbar>; they're passed in as props so this
 * component stays presentational and the fetch logic isn't duplicated.
 *
 * The hamburger menu is intentionally left intact (it still lists everything) —
 * this bar is an additive quick-access layer for the three primary destinations.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Search, BookOpen, Layers, FileText, TrendingUp, Plus, Users, Trophy, Zap, Heart,
} from "lucide-react"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { canUseVolzar, type VolzarAccessFlags } from "@/lib/ai/volzar-access"
import { volzarInstantHref } from "@/app/volzar/instant-link"

type DeckSort = "updated" | "name" | "created"

interface MobileTabBarProps {
  user: unknown
  binders: any[]
  bindersLoading: boolean
  bindersHasPinned: boolean
  loadBindersOnDemand: () => void
  decks: any[]
  decksLoading: boolean
  decksHasPinned: boolean
  loadDecksOnDemand: () => void
  navDeckSort: DeckSort
  setNavDeckSort: (v: DeckSort) => void
}

const TAB = "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"

export default function MobileTabBar({
  user,
  binders, bindersLoading, bindersHasPinned, loadBindersOnDemand,
  decks, decksLoading, decksHasPinned, loadDecksOnDemand,
  navDeckSort, setNavDeckSort,
}: MobileTabBarProps) {
  const pathname = usePathname() || "/"
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [decksOpen, setDecksOpen] = useState(false)
  const [instantOpen, setInstantOpen] = useState(false)

  // Volzar-access users get a ⚡ Instant sheet in place of the Search tab
  // (Search stays reachable as the sheet's first item). Same session-flag
  // gate as the desktop navbar's Volzar link.
  const hasVolzar = canUseVolzar(user as VolzarAccessFlags | null)

  const searchActive = pathname.startsWith("/opt")
  const instantActive = pathname.startsWith("/opt") || pathname.startsWith("/volzar")
  const collectionActive = pathname.startsWith("/collection") || pathname.startsWith("/binder/") || pathname.startsWith("/wants") || pathname.startsWith("/daily")
  const decksActive = pathname.startsWith("/decks")

  const tone = (active: boolean) =>
    active ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"

  // A quick link inside a sheet; closes the sheet on tap.
  const SheetLink = ({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) => (
    <DrawerClose asChild>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
        {children}
      </Link>
    </DrawerClose>
  )

  const sortedDecks = [...decks].sort((a, b) => {
    if (navDeckSort === "name") return a.name.localeCompare(b.name)
    if (navDeckSort === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <>
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-gray-300 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {/* Order: Collection · Instant · Decks — the ⚡ hub sits in the
            middle (thumb-reach primary), flanked by the two libraries. */}
        {user ? (
          <button
            type="button"
            onClick={() => { loadBindersOnDemand(); setCollectionOpen(true) }}
            aria-haspopup="dialog"
            aria-expanded={collectionOpen}
            className={cn(TAB, tone(collectionActive))}
          >
            <BookOpen className="h-5 w-5" />
            Collection
          </button>
        ) : (
          <Link href="/collection" aria-current={collectionActive ? "page" : undefined} className={cn(TAB, tone(collectionActive))}>
            <BookOpen className="h-5 w-5" />
            Collection
          </Link>
        )}

        {hasVolzar ? (
          <button
            type="button"
            onClick={() => setInstantOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={instantOpen}
            className={cn(TAB, tone(instantActive))}
          >
            <Zap className="h-5 w-5" />
            Instant
          </button>
        ) : (
          <Link href="/opt" aria-current={searchActive ? "page" : undefined} className={cn(TAB, tone(searchActive))}>
            <Search className="h-5 w-5" />
            Search
          </Link>
        )}

        {user ? (
          <button
            type="button"
            onClick={() => { loadDecksOnDemand(); setDecksOpen(true) }}
            aria-haspopup="dialog"
            aria-expanded={decksOpen}
            className={cn(TAB, tone(decksActive))}
          >
            <Layers className="h-5 w-5" />
            Decks
          </button>
        ) : (
          <Link href="/decks" aria-current={decksActive ? "page" : undefined} className={cn(TAB, tone(decksActive))}>
            <Layers className="h-5 w-5" />
            Decks
          </Link>
        )}
      </nav>

      {/* ⚡ Instant sheet (Volzar-access users) — search + Volzar deep links.
          The instant items land on /volzar and auto-run with zero AI tokens
          (?action= is consumed one-shot by VolzarChat). */}
      <Drawer open={instantOpen} onOpenChange={setInstantOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="py-3">
            <DrawerTitle className="flex items-center gap-1.5">
              <Zap className="h-4 w-4" aria-hidden="true" /> Instant
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <SheetLink href="/opt" icon={Search}>Search cards</SheetLink>
            <DrawerClose asChild>
              <Link
                href="/volzar"
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {/* Volzar, the Lightning Rod card art — same mark as the navbar link */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/volzar-icon.png" alt="" aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                Ask Volzar
              </Link>
            </DrawerClose>

            <div className="border-t border-gray-300 dark:border-gray-800 my-1" />

            <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Instant — no AI
            </div>
            <SheetLink href={volzarInstantHref("binders")} icon={BookOpen}>My binders</SheetLink>
            <SheetLink href={volzarInstantHref("wants")} icon={Heart}>My wants</SheetLink>
            {/* Opens the decks listing IN Volzar (?action=decks auto-run) —
                NOT the /decks page; the Decks tab's own sheet covers that. */}
            <SheetLink href={volzarInstantHref("decks")} icon={Layers}>My decks</SheetLink>
            <SheetLink href={volzarInstantHref("to-beat")} icon={Trophy}>Decks to Beat</SheetLink>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Collection sheet */}
      <Drawer open={collectionOpen} onOpenChange={setCollectionOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="py-3">
            <DrawerTitle>Your Collection</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <SheetLink href="/collection" icon={BookOpen}>View All Binders</SheetLink>
            <SheetLink href="/wants" icon={FileText}>Wants List</SheetLink>
            <SheetLink href="/daily" icon={TrendingUp}>Daily Movers</SheetLink>

            <div className="border-t border-gray-300 dark:border-gray-800 my-1" />

            {!bindersLoading && !bindersHasPinned && binders.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
                Showing your most recent binders.{" "}
                <DrawerClose asChild>
                  <Link href="/collection" className="text-blue-600 dark:text-blue-400 hover:underline">Pin binders</Link>
                </DrawerClose>{" "}
                to choose what appears here.
              </div>
            )}

            {bindersLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading binders…</div>
            ) : binders.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No binders yet</div>
            ) : (
              binders.map((binder) => {
                const slug = binder.slug || binder.discordExternalId
                return (
                  <DrawerClose asChild key={binder._id}>
                    <Link
                      href={`/binder/${binder._id}`}
                      className="flex flex-col px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{binder.name}</span>
                      {slug && <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{slug}</span>}
                    </Link>
                  </DrawerClose>
                )
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Decks sheet */}
      <Drawer open={decksOpen} onOpenChange={setDecksOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="py-3">
            <DrawerTitle>Your Decks</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <SheetLink href="/decks" icon={Layers}>View Your Decks</SheetLink>
            <SheetLink href="/decks?create=true" icon={Plus}>New Deck</SheetLink>
            <SheetLink href="/decks/community" icon={Users}>Community Decks</SheetLink>
            <SheetLink href="/decks/to-beat" icon={Trophy}>Decks to Beat</SheetLink>

            <div className="border-t border-gray-300 dark:border-gray-800 my-1" />

            {decks.length > 0 && (
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{decksHasPinned ? "Pinned decks" : "Recent decks"}</span>
                <select
                  value={navDeckSort}
                  onChange={(e) => setNavDeckSort(e.target.value as DeckSort)}
                  className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none cursor-pointer"
                >
                  <option value="updated">Last updated</option>
                  <option value="created">Date created</option>
                  <option value="name">Name</option>
                </select>
              </div>
            )}

            {!decksLoading && !decksHasPinned && decks.length > 0 && (
              <div className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
                Showing your most recent decks.{" "}
                <DrawerClose asChild>
                  <Link href="/decks" className="text-blue-600 dark:text-blue-400 hover:underline">Pin decks</Link>
                </DrawerClose>{" "}
                to choose what appears here.
              </div>
            )}

            {decksLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading decks…</div>
            ) : decks.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No decks yet</div>
            ) : (
              sortedDecks.map((deck) => {
                const heroName = Array.isArray(deck.hero) && deck.hero.length > 0
                  ? deck.hero[0]?.printingDetails?.display_name || deck.hero[0]?.printingId
                  : null
                return (
                  <DrawerClose asChild key={deck._id || deck.publicId}>
                    <Link
                      href={`/decks/${deck.publicId}`}
                      className="flex flex-col px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{deck.name}</span>
                      {heroName && <span className="text-xs text-gray-500 dark:text-gray-400">{heroName}</span>}
                    </Link>
                  </DrawerClose>
                )
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

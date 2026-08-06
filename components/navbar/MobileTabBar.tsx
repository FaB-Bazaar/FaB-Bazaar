"use client"

/**
 * Mobile-only bottom nav (sm:hidden): a floating rounded pill of tabs plus a
 * detached circular Search FAB (→ /opt) beside it, Slack-mobile style.
 *   • Collection → opens a bottom sheet of quick links + pinned/recent binders
 *   • Volzar     → (signed-in) opens a sheet of Volzar + zero-token deep links
 *   • Decks      → opens a bottom sheet of quick links + pinned/recent decks
 * Signed-out users get a two-tab pill (Collection · Decks) — the FAB owns search.
 *
 * Collection/Decks mirror the desktop navbar dropdowns. The binder/deck data
 * and the on-demand loaders live in <Navbar>; they're passed in as props so this
 * component stays presentational and the fetch logic isn't duplicated.
 *
 * The hamburger menu is intentionally left intact (it still lists everything) —
 * this bar is an additive quick-access layer for the primary destinations.
 *
 * Hidden entirely on the deck editor (/decks/[deckId]) — that page renders its
 * own floating tab pill (Cards/Deck/Matchups/…) and must not fight the FAB.
 *
 * Content clearance: the app shell reserves bottom padding for this bar
 * (app/layout.tsx spacer) and the Volzar mobile shell hardcodes the matching
 * height — change geometry here and both must move in lockstep.
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

const TAB = "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 min-h-12 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"

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
  const instantActive = pathname.startsWith("/volzar")
  const collectionActive = pathname.startsWith("/collection") || pathname.startsWith("/binder/") || pathname.startsWith("/wants") || pathname.startsWith("/daily")
  const decksActive = pathname.startsWith("/decks")

  // Filled active state (shape cue, not color-only) — matches the FAB.
  const tone = (active: boolean) =>
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground"

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

  // The deck editor page renders its own floating tab pill (Cards/Deck/…);
  // hide the site nav there — unlike the old full-width bars, a floating pill
  // can't simply cover the detached FAB with a higher z-index.
  // /decks/community and /decks/to-beat are listing pages, not the editor.
  const deckSeg = /^\/decks\/([^/]+)\/?$/.exec(pathname)?.[1]
  if (deckSeg && deckSeg !== "community" && deckSeg !== "to-beat") return null

  return (
    <>
      {/* pointer-events-none wrapper: only the pill + FAB capture taps, the
          gap between them stays tappable-through to page content. */}
      <div className="sm:hidden fixed z-40 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] inset-x-3 flex items-center justify-center gap-3 pointer-events-none">
        <nav
          className="pointer-events-auto flex flex-1 max-w-sm items-stretch gap-1 rounded-full border border-border bg-card/90 supports-[backdrop-filter]:bg-card/75 backdrop-blur-md shadow-lg p-1.5"
          aria-label="Primary"
        >
          {/* Order: Collection · Volzar · Decks — the Volzar hub sits in the
              middle (thumb-reach primary), flanked by the two libraries.
              Signed-out: just the two library links (the FAB owns search). */}
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

          {hasVolzar && (
            <button
              type="button"
              onClick={() => setInstantOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={instantOpen}
              className={cn(TAB, tone(instantActive))}
            >
              {/* Volzar, the Lightning Rod card art — same mark as the navbar link */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/volzar-icon.png" alt="" aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full object-cover" />
              Volzar
            </button>
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

        {/* Detached Search FAB — Slack-style circular action beside the pill */}
        <Link
          href="/opt"
          aria-label="Search cards"
          aria-current={searchActive ? "page" : undefined}
          className={cn(
            "pointer-events-auto h-14 w-14 shrink-0 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            searchActive && "ring-2 ring-blue-400",
          )}
        >
          <Search className="h-6 w-6" />
        </Link>
      </div>

      {/* Volzar sheet (Volzar-access users) — chat + zero-token deep links.
          The instant items land on /volzar and auto-run with zero AI tokens
          (?action= is consumed one-shot by VolzarChat). */}
      <Drawer open={instantOpen} onOpenChange={setInstantOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="py-3">
            <DrawerTitle className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/volzar-icon.png" alt="" aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full object-cover" /> Volzar
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {/* No "Search cards" row — the detached FAB owns search now */}
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
            <SheetLink href={volzarInstantHref("daily")} icon={TrendingUp}>Daily movers</SheetLink>
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
                // Summary DTOs (this fetch) carry heroImageUrl/heroDisplayName;
                // full DTOs embed hero[0].printingDetails. Only stored image_urls
                // render — constructed printing_id CDN URLs 404 (deleted 2026-07).
                const heroImgUrl = deck.heroImageUrl || deck.hero?.[0]?.printingDetails?.image_url || null
                const heroName = deck.heroDisplayName
                  || (Array.isArray(deck.hero) && deck.hero.length > 0
                    ? deck.hero[0]?.printingDetails?.display_name || deck.hero[0]?.printingId
                    : null)
                return (
                  <DrawerClose asChild key={deck._id || deck.publicId}>
                    <Link
                      href={`/decks/${deck.publicId}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      {heroImgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={heroImgUrl} alt="" aria-hidden="true" className="w-8 h-11 shrink-0 rounded object-cover" />
                      ) : (
                        // Placeholder keeps hero-less rows aligned with the rest.
                        <div aria-hidden="true" className="w-8 h-11 shrink-0 rounded border border-dashed border-gray-300 dark:border-gray-700" />
                      )}
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{deck.name}</span>
                        {heroName && <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{heroName}</span>}
                      </span>
                      {(deck.wins ?? 0) + (deck.losses ?? 0) > 0 && (
                        <span
                          className="ml-auto shrink-0 pl-3 text-sm tabular-nums text-gray-600 dark:text-gray-300"
                          aria-label={`${deck.wins} wins, ${deck.losses} losses`}
                        >
                          {deck.wins}–{deck.losses}
                        </span>
                      )}
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

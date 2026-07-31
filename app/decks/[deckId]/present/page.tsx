// app/decks/[deckId]/present/page.tsx
// Read-only, chrome-free deck view for streaming / decktech.
"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Loader2, X, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, Maximize2, ScrollText } from "lucide-react"
import { toTalisharIdentifier } from "@/lib/utils"
import { decksClient, heroesClient } from "@/lib/client"
import { artStylesFromPrinting, foilInsetFromValues } from "@/lib/foil"
import { HERO_INFO, YOUNG_HERO_INFO } from "@/lib/fab-constants"
import { toHeroDisplayName } from "@/lib/fab-constants/heroes"
import { getHeroPortraitUrl } from "@/lib/fab-constants/heroPortraits"
import { Bookmark, Swords, RotateCcw } from "lucide-react"
import { trackDeckPresent } from "@/lib/gtag"

interface PresenterCard {
  printingId: string
  quantity: number
  printingDetails?: {
    display_name?: string
    name?: string
    image_url?: string
    pitch?: number | null
    cost?: number | null
    power?: number | null
    defense?: number | null
    text?: string
    type_text_display?: string
    type_text?: string
    types?: string[]
    card_unique_id?: string
    foiling?: string
    is_extended_art?: boolean
    art_variations?: string[]
    foil_inset_top?: number | null
    foil_inset_right?: number | null
    foil_inset_bottom?: number | null
    foil_inset_left?: number | null
    foil_inset_round?: string | null
  }
}

interface PresenterDeck {
  _id?: string
  publicId?: string
  name: string
  format?: string
  heroName?: string | null
  description?: string | null
  hero?: PresenterCard[]
  equipment?: PresenterCard[]
  maindeck?: PresenterCard[]
  inventory?: PresenterCard[]
}

// WebGL holo card — client-only, lazy so three.js stays out of the main bundle.
const HoloCard3D = dynamic(() => import("@/components/deck/HoloCard3D"), { ssr: false })

// Freehand whiteboard overlay — only renders client-side (uses canvas + window).
const DrawingOverlay = dynamic(() => import("@/components/deck/DrawingOverlay"), { ssr: false })

const PITCH_LABEL: Record<number, { dot: string; text: string; bg: string }> = {
  1: { dot: "bg-red-500", text: "text-red-300", bg: "bg-red-500/10" },
  2: { dot: "bg-yellow-400", text: "text-yellow-300", bg: "bg-yellow-400/10" },
  3: { dot: "bg-blue-500", text: "text-blue-300", bg: "bg-blue-500/10" },
}

function pitchName(p?: number | null): string {
  return p === 1 ? "red" : p === 2 ? "yellow" : p === 3 ? "blue" : ""
}

const STRATEGY_LABELS: Record<string, string> = { aggro: 'Aggro', fatigue: 'Fatigue', combo: 'Combo', midrange: 'Midrange' }

function heroDisplayFromTalisharId(heroId: string): string {
  if (heroId === 'core') return 'Core'
  if (STRATEGY_LABELS[heroId]) return STRATEGY_LABELS[heroId]
  const match =
    Object.keys(HERO_INFO).find(k => toTalisharIdentifier(k) === heroId) ||
    Object.keys(YOUNG_HERO_INFO).find(k => toTalisharIdentifier(k) === heroId)
  return match ? toHeroDisplayName(match) : heroId
}

function cardTalisharId(card: PresenterCard): string {
  const base = toTalisharIdentifier(card.printingDetails?.name || '')
  if (!base) return ''
  const p = card.printingDetails?.pitch
  if (p === 1) return `${base}_red`
  if (p === 2) return `${base}_yellow`
  if (p === 3) return `${base}_blue`
  return base
}

function countOccurrences(ids: string[] | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

// Apply a matchup's sideboard diff to a maindeck:
//   maindeckPlayed = maindeck - out + in (cards from inventory)
function applyMatchupDiff(
  maindeck: PresenterCard[],
  inventory: PresenterCard[],
  sideboard: { in: string[]; out: string[] }
): PresenterCard[] {
  const outCounts = countOccurrences(sideboard.out)
  const inCounts = countOccurrences(sideboard.in)
  const result: PresenterCard[] = []

  for (const card of maindeck) {
    const tid = cardTalisharId(card)
    const remove = outCounts.get(tid) ?? 0
    const newQty = (card.quantity || 1) - remove
    if (newQty > 0) result.push({ ...card, quantity: newQty })
  }

  for (const card of inventory) {
    const tid = cardTalisharId(card)
    const add = inCounts.get(tid) ?? 0
    if (add <= 0) continue
    const existing = result.find(c => cardTalisharId(c) === tid)
    if (existing) existing.quantity = (existing.quantity || 1) + add
    else result.push({ ...card, quantity: add })
  }

  return result
}

interface Matchup {
  heroId: string
  preferredTurnOrder: string | null
  notes: string | null
  sideboard: { in: string[]; out: string[] }
}

function cardTotal(cards: PresenterCard[] | undefined): number {
  return (cards ?? []).reduce((s, c) => s + (c.quantity || 1), 0)
}

// One-viewport screenshot layout: hero + meta on the left, card columns grouped
// by section on the right. Tile size is computed from the tallest column so the
// whole deck fits inside the viewport without scrolling.
function FitView({
  deck,
  sections,
  totalCards,
  pitchStats,
  onCardClick,
}: {
  deck: PresenterDeck
  sections: Array<{ key: string; title: string; accent: string; cards: PresenterCard[] }>
  totalCards: number
  pitchStats: { red: number; yellow: number; blue: number; none: number }
  onCardClick: (card: PresenterCard) => void
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [includeInventory, setIncludeInventory] = useState(false)
  const [layout, setLayout] = useState<{ tileW: number; lanes: Array<{ sectionIdx: number; cards: PresenterCard[]; isFirstLane: boolean }> }>({ tileW: 120, lanes: [] })

  const heroCard = deck.hero?.[0]
  const cardCols = useMemo(
    () => sections.filter(s => s.key !== 'hero' && (includeInventory || s.key !== 'inventory')),
    [sections, includeInventory]
  )

  // Recompute the optimal tile width + per-section sub-column count whenever
  // the viewport or deck shape changes. Strategy: try tileW from large to small;
  // for each, compute how many cards fit in one column, split tall sections into
  // additional lanes accordingly, and pick the first tileW where the total fits
  // horizontally. This maximises tile size while keeping everything above the fold.
  useEffect(() => {
    const recompute = () => {
      const el = bodyRef.current
      if (!el) return
      const w = el.clientWidth
      const h = el.clientHeight
      const aspect = 88 / 63
      const overlap = 0.30
      const gap = 8
      const labelH = 26

      let best: { tileW: number; lanes: Array<{ sectionIdx: number; cards: PresenterCard[]; isFirstLane: boolean }> } | null = null
      for (let tileW = 240; tileW >= 70; tileW -= 2) {
        const cardH = tileW * aspect
        const colHeightAvail = h - labelH - 4
        if (cardH > colHeightAvail) continue
        const maxPerCol = Math.max(1, Math.floor((colHeightAvail - cardH) / (cardH * overlap)) + 1)
        const lanes: Array<{ sectionIdx: number; cards: PresenterCard[]; isFirstLane: boolean }> = []
        cardCols.forEach((s, si) => {
          const subCols = Math.max(1, Math.ceil(s.cards.length / maxPerCol))
          for (let k = 0; k < subCols; k++) {
            lanes.push({
              sectionIdx: si,
              cards: s.cards.slice(k * maxPerCol, (k + 1) * maxPerCol),
              isFirstLane: k === 0,
            })
          }
        })
        const totalW = lanes.length * tileW + Math.max(0, lanes.length - 1) * gap
        if (totalW <= w) {
          best = { tileW, lanes }
          break
        }
      }
      // Fallback: tiniest tile, one column per section (cards may overflow but
      // this only triggers on absurdly small viewports).
      if (!best) {
        const lanes = cardCols.map((s, si) => ({ sectionIdx: si, cards: s.cards, isFirstLane: true }))
        best = { tileW: 70, lanes }
      }
      setLayout(best)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    if (bodyRef.current) ro.observe(bodyRef.current)
    return () => ro.disconnect()
  }, [cardCols])

  const tileW = layout.tileW
  const tileH = Math.round(tileW * 88 / 63)
  const stackStep = Math.max(24, Math.round(tileH * 0.30))

  return (
    <div className="h-screen flex flex-col px-8 pt-32 pb-4 gap-3">
      {/* Header — centered, with hero portrait inline so it doesn't steal vertical space */}
      <div className="flex items-center gap-4 flex-shrink-0 max-w-6xl mx-auto w-full">
        {heroCard?.printingDetails?.image_url && (
          <img
            src={heroCard.printingDetails.image_url}
            alt={heroCard.printingDetails.display_name || heroCard.printingDetails.name || "Hero"}
            className="h-20 w-auto rounded-lg shadow-xl ring-1 ring-white/10 flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight truncate">{deck.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-300">
            {deck.format && (
              <span className="px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/60 text-blue-200">{deck.format}</span>
            )}
            {deck.heroName && (
              <span className="px-2 py-0.5 rounded-full bg-gray-800/70 border border-gray-700">{toHeroDisplayName(deck.heroName)}</span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-gray-800/70 border border-gray-700">{totalCards} cards</span>
            {pitchStats.red > 0 && (
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${PITCH_LABEL[1].bg} border border-red-500/40 ${PITCH_LABEL[1].text} font-medium`}>
                <span className={`w-1.5 h-1.5 rounded-full ${PITCH_LABEL[1].dot}`} />
                <span className="font-bold">{pitchStats.red}</span> red
              </span>
            )}
            {pitchStats.yellow > 0 && (
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${PITCH_LABEL[2].bg} border border-yellow-500/40 ${PITCH_LABEL[2].text} font-medium`}>
                <span className={`w-1.5 h-1.5 rounded-full ${PITCH_LABEL[2].dot}`} />
                <span className="font-bold">{pitchStats.yellow}</span> yellow
              </span>
            )}
            {pitchStats.blue > 0 && (
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${PITCH_LABEL[3].bg} border border-blue-500/40 ${PITCH_LABEL[3].text} font-medium`}>
                <span className={`w-1.5 h-1.5 rounded-full ${PITCH_LABEL[3].dot}`} />
                <span className="font-bold">{pitchStats.blue}</span> blue
              </span>
            )}
            {pitchStats.none > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                <span className="font-bold">{pitchStats.none}</span> no pitch
              </span>
            )}
          </div>
        </div>
        {(deck.inventory?.length ?? 0) > 0 && (
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none flex-shrink-0">
            <input
              type="checkbox"
              checked={includeInventory}
              onChange={e => setIncludeInventory(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus-visible:ring-blue-400"
            />
            Show inventory
          </label>
        )}
      </div>

      {/* Card columns — tall sections wrap into multiple lanes */}
      <div ref={bodyRef} className="flex-1 min-h-0 flex items-start justify-center gap-2 overflow-hidden">
        {layout.lanes.map((lane, laneIdx) => {
          const section = cardCols[lane.sectionIdx]
          if (!section) return null
          const cards = lane.cards
          const colHeight = tileH + Math.max(0, cards.length - 1) * stackStep
          const sectionTotal = section.cards.reduce((s, x) => s + (x.quantity || 1), 0)
          return (
            <div key={`${section.key}-${laneIdx}`} className="flex flex-col items-center" style={{ width: tileW }}>
              <div className={`text-xs font-bold uppercase tracking-wider mb-1.5 truncate w-full text-center ${lane.isFirstLane ? section.accent : 'text-transparent'}`}>
                {lane.isFirstLane ? (
                  <>
                    {section.title.replace('Library — ', '')} <span className="text-gray-500 font-normal">({sectionTotal})</span>
                  </>
                ) : '·'}
              </div>
              <div className="relative" style={{ width: tileW, height: colHeight }}>
                {cards.map((c, i) => {
                  const qty = c.quantity || 1
                  return (
                    <button
                      key={`${c.printingId}-${i}`}
                      type="button"
                      onClick={() => onCardClick(c)}
                      className="absolute left-0 rounded-md overflow-hidden ring-1 ring-gray-700 hover:ring-blue-400 hover:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-shadow"
                      style={{ width: tileW, height: tileH, top: i * stackStep, zIndex: i }}
                      title={`${qty}× ${c.printingDetails?.display_name || c.printingDetails?.name || ''}`}
                    >
                      {c.printingDetails?.image_url ? (
                        <img
                          src={c.printingDetails.image_url}
                          alt={c.printingDetails.display_name || c.printingDetails.name || 'Card'}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-1 text-center text-[10px] text-gray-300">
                          {c.printingDetails?.display_name || c.printingDetails?.name || c.printingId}
                        </div>
                      )}
                      {qty > 1 && (
                        <span
                          aria-label={`${qty} copies`}
                          className="absolute top-1 right-1 min-w-[28px] h-7 px-1.5 rounded-full bg-blue-600 ring-2 ring-white text-white text-sm font-black flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                        >
                          ×{qty}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PresenterPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = params.deckId as string

  const [deck, setDeck] = useState<PresenterDeck | null>(null)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [heroImageMap, setHeroImageMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter the deck by an applied matchup; null = base deck.
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null)

  // Spotlight state — flat list of all cards in presentation order.
  const [spotlightIdx, setSpotlightIdx] = useState<number | null>(null)

  // 'scroll' = full presenter; 'fit' = one-viewport screenshot layout.
  const [viewMode, setViewMode] = useState<'scroll' | 'fit'>('fit')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // First paint blocks only on the deck + matchups (both fast). The hero
    // portrait maps decorate matchup chips and arrive whenever they arrive —
    // gating the spinner on them held the whole page hostage to the slowest
    // hero-printings response.
    Promise.all([
      decksClient.getDeck(deckId).catch(() => null),
      decksClient.getDeckMatchups(deckId).catch(() => null),
    ])
      .then(([deckBody, muBody]) => {
        if (cancelled) return
        if (!deckBody?.success) {
          setError(deckBody?.error || "Failed to load deck")
        } else {
          setDeck(deckBody.data as any)
          trackDeckPresent({
            deck_id: deckId,
            deck_name: deckBody.data?.name,
            format: deckBody.data?.format,
            hero: deckBody.data?.heroName,
          })
        }
        if (muBody?.success) setMatchups(muBody.data?.matchups ?? [])
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    // Non-blocking: hero portraits for matchup chips upgrade in place.
    Promise.all([
      heroesClient.getHeroPrintings("adult").catch(() => null),
      heroesClient.getHeroPrintings("young").catch(() => null),
    ]).then(([adultBody, youngBody]) => {
      if (cancelled) return
      const map = new Map<string, string>()
      const adultHeroes = adultBody?.success ? adultBody.data.heroes : []
      const youngHeroes = youngBody?.success ? youngBody.data.heroes : []
      for (const h of adultHeroes) {
        const tId = toTalisharIdentifier(h.name)
        if (tId && h.image_url) map.set(tId, h.image_url)
      }
      for (const h of youngHeroes) {
        const tId = toTalisharIdentifier(h.name)
        if (tId && h.image_url) map.set(tId, h.image_url)
      }
      setHeroImageMap(map)
    })

    return () => { cancelled = true }
  }, [deckId])

  const selectedMatchup = useMemo(
    () => (selectedMatchupId ? matchups.find(m => m.heroId === selectedMatchupId) ?? null : null),
    [selectedMatchupId, matchups]
  )

  // Grouped sections in presentation order. When a matchup is selected, the
  // maindeck is rebuilt with its sideboard diff applied (cards moved out are
  // removed; cards moved in are pulled from inventory) and Inventory is hidden
  // — the player only sees what stays in the deck for that matchup.
  const sections = useMemo(() => {
    if (!deck) return [] as Array<{ key: string; title: string; accent: string; cards: PresenterCard[] }>
    const maindeckCards = selectedMatchup
      ? applyMatchupDiff(deck.maindeck ?? [], deck.inventory ?? [], selectedMatchup.sideboard)
      : (deck.maindeck ?? [])
    const byPitch = (p: number) => maindeckCards.filter(c => c.printingDetails?.pitch === p)
    const noPitch = maindeckCards.filter(c => !c.printingDetails?.pitch)
    const result: Array<{ key: string; title: string; accent: string; cards: PresenterCard[] }> = [
      { key: "hero", title: "Hero", accent: "text-amber-300", cards: deck.hero ?? [] },
      { key: "equipment", title: "Equipment & Weapons", accent: "text-gray-300", cards: deck.equipment ?? [] },
      { key: "red", title: "Library — Red", accent: "text-red-400", cards: byPitch(1) },
      { key: "yellow", title: "Library — Yellow", accent: "text-yellow-400", cards: byPitch(2) },
      { key: "blue", title: "Library — Blue", accent: "text-blue-400", cards: byPitch(3) },
      { key: "no-pitch", title: "Library — No Pitch", accent: "text-gray-400", cards: noPitch },
    ]
    if (!selectedMatchup) {
      result.push({ key: "inventory", title: "Inventory", accent: "text-gray-300", cards: deck.inventory ?? [] })
    }
    return result.filter(s => s.cards.length > 0)
  }, [deck, selectedMatchup])

  // Sorted matchups for the tile row: core first, then strategies, then heroes alphabetical.
  const sortedMatchups = useMemo(() => {
    const STRATEGY_ORDER: Record<string, number> = { aggro: 0, fatigue: 1, combo: 2, midrange: 3 }
    return [...matchups].sort((a, b) => {
      if (a.heroId === 'core') return -1
      if (b.heroId === 'core') return 1
      const aStrat = STRATEGY_ORDER[a.heroId]
      const bStrat = STRATEGY_ORDER[b.heroId]
      if (aStrat !== undefined && bStrat !== undefined) return aStrat - bStrat
      if (aStrat !== undefined) return -1
      if (bStrat !== undefined) return 1
      return heroDisplayFromTalisharId(a.heroId).localeCompare(heroDisplayFromTalisharId(b.heroId))
    })
  }, [matchups])

  // Flat list of cards in presentation order — one entry per tile (i.e. per
  // unique printing + category); spotlight cycles through this list.
  const flatCards = useMemo(() => {
    const out: PresenterCard[] = []
    for (const s of sections) out.push(...s.cards)
    return out
  }, [sections])

  const pitchStats = useMemo(() => {
    if (!deck) return { red: 0, yellow: 0, blue: 0, none: 0 }
    const all = [...(deck.maindeck ?? []), ...(deck.inventory ?? []), ...(deck.equipment ?? [])]
    let red = 0, yellow = 0, blue = 0, none = 0
    for (const c of all) {
      const q = c.quantity || 1
      const p = c.printingDetails?.pitch
      if (p === 1) red += q
      else if (p === 2) yellow += q
      else if (p === 3) blue += q
      else none += q
    }
    return { red, yellow, blue, none }
  }, [deck])

  const totalCards = cardTotal(deck?.maindeck) + cardTotal(deck?.equipment) + cardTotal(deck?.inventory)

  const openSpotlight = useCallback((card: PresenterCard) => {
    const idx = flatCards.indexOf(card)
    setSpotlightIdx(idx >= 0 ? idx : null)
  }, [flatCards])

  const closeSpotlight = useCallback(() => setSpotlightIdx(null), [])

  // Keyboard: ESC exits spotlight (or exits presenter mode); arrows navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (spotlightIdx !== null) { closeSpotlight(); return }
        router.push(`/decks/${deckId}`)
        return
      }
      if (spotlightIdx === null) return
      if (e.key === "ArrowRight") {
        setSpotlightIdx(i => (i === null ? null : Math.min(flatCards.length - 1, i + 1)))
      } else if (e.key === "ArrowLeft") {
        setSpotlightIdx(i => (i === null ? null : Math.max(0, i - 1)))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [spotlightIdx, flatCards.length, closeSpotlight, deckId, router])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-gray-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (error || !deck) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 text-gray-200 gap-4 p-8 text-center">
        <div className="text-lg">{error || "Deck not found"}</div>
        <Link href={`/decks/${deckId}`} className="text-sm text-blue-400 hover:text-blue-300 underline">
          Back to deck editor
        </Link>
      </div>
    )
  }

  const heroCard = deck.hero?.[0]
  const spotlightCard = spotlightIdx !== null ? flatCards[spotlightIdx] : null

  // Foil props for the 3D spotlight card — shared policy from lib/foil.
  const sd = spotlightCard?.printingDetails
  const spotlightArtStyles = artStylesFromPrinting(sd?.art_variations, sd?.is_extended_art)
  const spotlightFoilInset = foilInsetFromValues(
    sd?.foil_inset_top, sd?.foil_inset_right, sd?.foil_inset_bottom, sd?.foil_inset_left, sd?.foil_inset_round
  )

  return (
    <div className={viewMode === 'fit' ? "fixed inset-0 z-40 overflow-hidden bg-gray-950 text-gray-100" : "min-h-screen bg-gray-950 text-gray-100"}>
      {/* Exit pill — always-visible, above the spotlight overlay so you can leave from anywhere */}
      <Link
        href={`/decks/${deckId}`}
        className="fixed top-20 left-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 border border-gray-600 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-400 backdrop-blur-md shadow-xl transition-colors"
        title="Exit presenter mode (Esc)"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to editor
      </Link>

      {/* View mode toggle — switch between scrollable presenter and a one-viewport fit layout for screenshots */}
      <button
        type="button"
        onClick={() => setViewMode(m => m === 'fit' ? 'scroll' : 'fit')}
        className="fixed top-20 right-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 border border-gray-600 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-400 backdrop-blur-md shadow-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        title={viewMode === 'fit' ? "Switch to scrollable view" : "Fit deck to screen (for screenshots)"}
      >
        {viewMode === 'fit' ? <ScrollText className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {viewMode === 'fit' ? "Scroll view" : "Fit to screen"}
      </button>

      {viewMode === 'fit' ? (
        <FitView
          deck={deck}
          sections={sections}
          totalCards={totalCards}
          pitchStats={pitchStats}
          onCardClick={openSpotlight}
        />
      ) : (<>


      <div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-8 lg:py-12">
        {/* Hero / header panel */}
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-10 mb-10">
          {heroCard?.printingDetails?.image_url && (
            <img
              src={heroCard.printingDetails.image_url}
              alt={heroCard.printingDetails.display_name || heroCard.printingDetails.name || "Hero"}
              className="w-60 lg:w-72 rounded-xl shadow-2xl ring-1 ring-white/10"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">{deck.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm lg:text-base text-gray-300">
              {deck.format && (
                <span className="px-3 py-1 rounded-full bg-blue-900/40 border border-blue-700/60 text-blue-200">{deck.format}</span>
              )}
              {deck.heroName && (
                <span className="px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700">Hero: {toHeroDisplayName(deck.heroName)}</span>
              )}
              <span className="px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700">{totalCards} cards</span>
            </div>

            {/* Pitch distribution */}
            <div className="mt-5 flex flex-wrap gap-2">
              {pitchStats.red > 0 && (
                <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${PITCH_LABEL[1].bg} border border-red-500/40 ${PITCH_LABEL[1].text} text-sm font-medium`}>
                  <span className={`w-2 h-2 rounded-full ${PITCH_LABEL[1].dot}`} />
                  <span className="font-bold">{pitchStats.red}</span> red
                </span>
              )}
              {pitchStats.yellow > 0 && (
                <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${PITCH_LABEL[2].bg} border border-yellow-500/40 ${PITCH_LABEL[2].text} text-sm font-medium`}>
                  <span className={`w-2 h-2 rounded-full ${PITCH_LABEL[2].dot}`} />
                  <span className="font-bold">{pitchStats.yellow}</span> yellow
                </span>
              )}
              {pitchStats.blue > 0 && (
                <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${PITCH_LABEL[3].bg} border border-blue-500/40 ${PITCH_LABEL[3].text} text-sm font-medium`}>
                  <span className={`w-2 h-2 rounded-full ${PITCH_LABEL[3].dot}`} />
                  <span className="font-bold">{pitchStats.blue}</span> blue
                </span>
              )}
              {pitchStats.none > 0 && (
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="font-bold">{pitchStats.none}</span> no pitch
                </span>
              )}
            </div>

            {deck.description && (
              <p className="mt-6 text-base lg:text-lg text-gray-300 leading-relaxed max-w-3xl whitespace-pre-wrap">{deck.description}</p>
            )}
          </div>
        </div>

        {/* Matchup tile row — click to filter cards to the played deck for that matchup */}
        {sortedMatchups.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-300">Matchups</h2>
              {selectedMatchup && (
                <button
                  type="button"
                  onClick={() => setSelectedMatchupId(null)}
                  className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
                  title="Show base deck"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to base deck
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedMatchupId(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  selectedMatchupId === null
                    ? 'border-blue-400 bg-blue-900/40 text-blue-50'
                    : 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-500 hover:text-gray-100'
                }`}
                title="Show the base deck"
              >
                <span className="w-9 h-9 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Bookmark className={`h-4 w-4 ${selectedMatchupId === null ? 'text-blue-300' : 'text-gray-400'}`} />
                </span>
                <span className="text-sm font-semibold">Base deck</span>
              </button>
              {sortedMatchups.map(m => {
                const isStrategy = m.heroId === 'core' || ['aggro', 'fatigue', 'combo', 'midrange'].includes(m.heroId)
                const portrait = !isStrategy ? getHeroPortraitUrl(m.heroId) : null
                const cardArt = !portrait && !isStrategy ? heroImageMap.get(m.heroId) : null
                const name = heroDisplayFromTalisharId(m.heroId)
                const isSelected = selectedMatchupId === m.heroId
                const ring = isSelected
                  ? 'border-blue-400 bg-blue-900/40 text-blue-50'
                  : 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-500 hover:text-gray-100'
                return (
                  <button
                    key={m.heroId}
                    type="button"
                    onClick={() => setSelectedMatchupId(isSelected ? null : m.heroId)}
                    className={`flex items-center gap-2 pl-1 pr-4 py-1 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${ring}`}
                    title={isSelected ? `Click to clear filter` : `Show played deck vs ${name}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-gray-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {portrait ? (
                        <img src={portrait} alt={name} className="w-full h-full object-cover object-top" />
                      ) : cardArt ? (
                        <img src={cardArt} alt={name} className="w-full h-full object-cover object-top" />
                      ) : m.heroId === 'core' ? (
                        <Bookmark className="h-4 w-4 text-blue-300" />
                      ) : isStrategy ? (
                        <Swords className="h-4 w-4 text-amber-300" />
                      ) : (
                        <span className="text-[10px] text-gray-300 uppercase">{name.slice(0, 2)}</span>
                      )}
                    </span>
                    <span className="text-sm font-semibold">{name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Card sections (skip hero — already shown big) */}
        <div className="space-y-10">
          {sections.filter(s => s.key !== "hero").map(section => (
            <section key={section.key}>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className={`text-xl lg:text-2xl font-bold uppercase tracking-wider ${section.accent}`}>
                  {section.title}
                </h2>
                <span className="text-sm text-gray-500">({cardTotal(section.cards)})</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 lg:gap-4">
                {section.cards.map(c => {
                  const qty = c.quantity || 1
                  return (
                    <button
                      key={c.printingId}
                      type="button"
                      onClick={() => openSpotlight(c)}
                      className="group relative aspect-[63/88] rounded-lg overflow-hidden ring-1 ring-gray-700 hover:ring-blue-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      title={`${qty}× ${c.printingDetails?.display_name || c.printingDetails?.name || "Card"}`}
                    >
                      {c.printingDetails?.image_url ? (
                        <img
                          src={c.printingDetails.image_url}
                          alt={c.printingDetails.display_name || c.printingDetails.name || "Card"}
                          className="w-full h-full object-cover object-top transition-transform group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-2 text-center text-xs text-gray-300">
                          {c.printingDetails?.display_name || c.printingDetails?.name || c.printingId}
                        </div>
                      )}
                      {qty > 1 && (
                        <span
                          aria-label={`${qty} copies`}
                          className="absolute bottom-2 right-2 min-w-[36px] h-9 px-2.5 rounded-full bg-blue-600/95 ring-2 ring-white/80 text-white text-base font-black flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                        >
                          ×{qty}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      </>)}

      {/* Card spotlight overlay — sits below the global navbar (h-16, z-50) so the navbar stays visible */}
      {spotlightCard && (
        <div
          className="fixed inset-x-0 bottom-0 top-16 z-40 flex items-center justify-center backdrop-blur-sm p-4 lg:p-8 bg-black/55"
          onClick={closeSpotlight}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeSpotlight}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
          {spotlightIdx !== null && spotlightIdx > 0 && (
            <button
              type="button"
              aria-label="Previous card"
              onClick={e => { e.stopPropagation(); setSpotlightIdx(i => (i === null ? null : Math.max(0, i - 1))) }}
              className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {spotlightIdx !== null && spotlightIdx < flatCards.length - 1 && (
            <button
              type="button"
              aria-label="Next card"
              onClick={e => { e.stopPropagation(); setSpotlightIdx(i => (i === null ? null : Math.min(flatCards.length - 1, i + 1))) }}
              className="absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-900/80 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Dismiss hint — the entire scrim is clickable; this makes that discoverable */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 pointer-events-none select-none">
            Click outside the card to close · Esc
          </div>

          <div
            // Constant-size panel: fixed width + height (clamped to viewport) so it
            // doesn't reflow when navigating between cards with different name /
            // text lengths. The text column scrolls internally if it overflows.
            className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 w-full max-w-5xl h-[min(calc(100vh-180px),780px)] overflow-hidden rounded-3xl border border-white/15 bg-slate-900/85 px-6 py-6 lg:px-12 lg:py-10 shadow-[0_24px_90px_rgba(0,0,0,0.75)] backdrop-blur-md"
            onClick={e => e.stopPropagation()}
          >
            {spotlightCard.printingDetails?.image_url && (
              <HoloCard3D
                src={spotlightCard.printingDetails.image_url}
                alt={spotlightCard.printingDetails.display_name || spotlightCard.printingDetails.name || "Card"}
                foiling={spotlightCard.printingDetails.foiling}
                artStyle={spotlightArtStyles}
                foilInset={spotlightFoilInset}
                className="flex-shrink-0 w-[min(62vw,330px,calc(46vh*63/88))] lg:w-[min(380px,calc(60vh*63/88))]"
              />
            )}
            <div className="flex-1 min-w-0 min-h-0 max-h-full overflow-y-auto text-gray-100 max-w-xl">
              {/* Large qty "×N" to the left of the name when > 1 */}
              <div className="flex items-baseline gap-4 flex-wrap">
                {(spotlightCard.quantity || 1) > 1 && (
                  <span className="text-6xl lg:text-7xl font-bold text-blue-300/90 leading-none">
                    ×{spotlightCard.quantity}
                  </span>
                )}
                <h3 className="text-3xl lg:text-5xl font-bold leading-tight">
                  {spotlightCard.printingDetails?.display_name || spotlightCard.printingDetails?.name}
                </h3>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {spotlightCard.printingDetails?.pitch != null && (
                  <span className={`flex items-center gap-2.5 px-4 py-2 rounded-full ${PITCH_LABEL[spotlightCard.printingDetails.pitch]?.bg} border-2 ${spotlightCard.printingDetails.pitch === 1 ? 'border-red-500/60' : spotlightCard.printingDetails.pitch === 2 ? 'border-yellow-500/60' : 'border-blue-500/60'} ${PITCH_LABEL[spotlightCard.printingDetails.pitch]?.text} text-base lg:text-lg font-semibold`}>
                    <span className={`w-3 h-3 rounded-full ${PITCH_LABEL[spotlightCard.printingDetails.pitch]?.dot}`} />
                    {pitchName(spotlightCard.printingDetails.pitch)}
                  </span>
                )}
              </div>

              {(spotlightCard.printingDetails?.type_text_display || spotlightCard.printingDetails?.type_text) && (
                <div className="mt-5 text-sm lg:text-base text-gray-400">
                  {spotlightCard.printingDetails?.type_text_display || spotlightCard.printingDetails?.type_text}
                </div>
              )}

              {/* Matchup sideboard chips — when this card is sided in or out for specific matchups */}
              {(() => {
                const talisharId = cardTalisharId(spotlightCard)
                if (!talisharId || matchups.length === 0) return null
                const outIn = matchups.filter(m => m.sideboard?.out?.includes(talisharId))
                const inIn = matchups.filter(m => m.sideboard?.in?.includes(talisharId))
                if (outIn.length === 0 && inIn.length === 0) return null
                const renderChip = (m: Matchup, tone: 'out' | 'in') => {
                  const name = heroDisplayFromTalisharId(m.heroId)
                  const img = heroImageMap.get(m.heroId)
                  const classes = tone === 'out'
                    ? "border-red-500/60 bg-red-900/30 text-red-50"
                    : "border-emerald-500/60 bg-emerald-900/30 text-emerald-50"
                  return (
                    <span
                      key={`${tone}-${m.heroId}`}
                      className={`flex items-center gap-2.5 pl-1 pr-4 py-1 rounded-full border-2 ${classes} text-base font-medium`}
                    >
                      <span className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 border border-white/20 flex-shrink-0">
                        {img ? (
                          <img
                            src={img}
                            alt={name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <span className="flex items-center justify-center w-full h-full text-[10px] text-gray-400 uppercase">
                            {name.slice(0, 2)}
                          </span>
                        )}
                      </span>
                      <span>{name}</span>
                    </span>
                  )
                }
                return (
                  <div className="mt-7 space-y-4">
                    {outIn.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-red-300 font-bold mb-2.5">
                          <ArrowDownLeft className="h-4 w-4" />
                          Sided out vs.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {outIn.map(m => renderChip(m, 'out'))}
                        </div>
                      </div>
                    )}
                    {inIn.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-emerald-300 font-bold mb-2.5">
                          <ArrowUpRight className="h-4 w-4" />
                          Sided in vs.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {inIn.map(m => renderChip(m, 'in'))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Whiteboard overlay — drawable in the fit view and while a card is spotlighted */}
      <DrawingOverlay available={viewMode === 'fit' || spotlightCard != null} />
    </div>
  )
}

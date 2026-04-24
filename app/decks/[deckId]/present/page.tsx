// app/decks/[deckId]/present/page.tsx
// Read-only, chrome-free deck view for streaming / decktech.
"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, X, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { toTalisharIdentifier } from "@/lib/utils"
import { HERO_INFO, YOUNG_HERO_INFO } from "@/lib/fab-constants"
import { toHeroDisplayName } from "@/lib/fab-constants/heroes"
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

interface Matchup {
  heroId: string
  preferredTurnOrder: string | null
  notes: string | null
  sideboard: { in: string[]; out: string[] }
}

function cardTotal(cards: PresenterCard[] | undefined): number {
  return (cards ?? []).reduce((s, c) => s + (c.quantity || 1), 0)
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

  // Spotlight state — flat list of all cards in presentation order.
  const [spotlightIdx, setSpotlightIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/decks/${deckId}`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`/api/decks/${deckId}/matchups`, { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch(`/api/hero-printings?format=adult`).then(r => r.json()).catch(() => null),
      fetch(`/api/hero-printings?format=young`).then(r => r.json()).catch(() => null),
    ])
      .then(([deckBody, muBody, adultBody, youngBody]) => {
        if (cancelled) return
        if (!deckBody?.success) {
          setError(deckBody?.error || "Failed to load deck")
        } else {
          setDeck(deckBody.data)
          trackDeckPresent({
            deck_id: deckId,
            deck_name: deckBody.data?.name,
            format: deckBody.data?.format,
            hero: deckBody.data?.heroName,
          })
        }
        if (muBody?.success) setMatchups(muBody.data?.matchups ?? [])

        const map = new Map<string, string>()
        for (const h of (adultBody?.heroes ?? [])) {
          const tId = toTalisharIdentifier(h.name)
          if (tId && h.image_url) map.set(tId, h.image_url)
        }
        for (const h of (youngBody?.heroes ?? [])) {
          const tId = toTalisharIdentifier(h.name)
          if (tId && h.image_url) map.set(tId, h.image_url)
        }
        setHeroImageMap(map)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [deckId])

  // Grouped sections in presentation order.
  const sections = useMemo(() => {
    if (!deck) return [] as Array<{ key: string; title: string; accent: string; cards: PresenterCard[] }>
    const byPitch = (p: number) => (deck.maindeck ?? []).filter(c => c.printingDetails?.pitch === p)
    const noPitch = (deck.maindeck ?? []).filter(c => !c.printingDetails?.pitch)
    return [
      { key: "hero", title: "Hero", accent: "text-amber-300", cards: deck.hero ?? [] },
      { key: "equipment", title: "Equipment & Weapons", accent: "text-gray-300", cards: deck.equipment ?? [] },
      { key: "red", title: "Library — Red", accent: "text-red-400", cards: byPitch(1) },
      { key: "yellow", title: "Library — Yellow", accent: "text-yellow-400", cards: byPitch(2) },
      { key: "blue", title: "Library — Blue", accent: "text-blue-400", cards: byPitch(3) },
      { key: "no-pitch", title: "Library — No Pitch", accent: "text-gray-400", cards: noPitch },
      { key: "inventory", title: "Inventory", accent: "text-gray-300", cards: deck.inventory ?? [] },
    ].filter(s => s.cards.length > 0)
  }, [deck])

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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Exit pill — always-visible, above the spotlight overlay so you can leave from anywhere */}
      <Link
        href={`/decks/${deckId}`}
        className="fixed top-4 left-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 border border-gray-600 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white hover:border-gray-400 backdrop-blur-md shadow-xl transition-colors"
        title="Exit presenter mode (Esc)"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to editor
      </Link>

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
                <span className="px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700">Hero: {deck.heroName}</span>
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

      {/* Card spotlight overlay */}
      {spotlightCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 lg:p-8"
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

          <div
            className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 max-w-6xl w-full"
            onClick={e => e.stopPropagation()}
          >
            {spotlightCard.printingDetails?.image_url && (
              <img
                src={spotlightCard.printingDetails.image_url}
                alt={spotlightCard.printingDetails.display_name || spotlightCard.printingDetails.name || "Card"}
                className="w-[360px] lg:w-[560px] rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
              />
            )}
            <div className="flex-1 min-w-0 text-gray-100 max-w-xl">
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
    </div>
  )
}

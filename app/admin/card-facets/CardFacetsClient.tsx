'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { searchPrintingsPost } from '@/lib/client/search-client'
import type { FacetTag, FacetDimension } from '@/lib/search/card-facets'
import type { PrintingDTO } from '@/lib/services/contracts/IPrintingsService'

const DIM_ORDER: FacetDimension[] = ['mechanical', 'strategic', 'synergy']
const DIM_LABEL: Record<FacetDimension, string> = {
  mechanical: 'Mechanical — what the text does',
  strategic: 'Strategic — how it is used',
  synergy: 'Synergy — named packages / lines',
}

type Mode = 'tag' | 'filter'

interface CardHit {
  cardUniqueId: string
  name: string
  pitch: number | null
  imageUrl: string
}

function toHit(p: PrintingDTO): CardHit {
  return {
    cardUniqueId: p.card_unique_id,
    name: p.name,
    pitch: p.pitch ?? null,
    imageUrl: p.image_url,
  }
}

export function CardFacetsClient({ facetTags }: { facetTags: FacetTag[] }) {
  const [mode, setMode] = useState<Mode>('tag')

  return (
    <div>
      <div className="flex gap-2 mb-6" role="tablist">
        <TabButton active={mode === 'tag'} onClick={() => setMode('tag')}>
          Tag a card
        </TabButton>
        <TabButton active={mode === 'filter'} onClick={() => setMode('filter')}>
          Filter by facets
        </TabButton>
      </div>

      {mode === 'tag' ? (
        <TagMode facetTags={facetTags} />
      ) : (
        <FilterMode facetTags={facetTags} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-semibold border-b-[3px] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
        active
          ? 'bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/60 dark:text-blue-200'
          : 'bg-gray-100 text-gray-700 border-transparent dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────── Tag mode ───────────────────

function TagMode({ facetTags }: { facetTags: FacetTag[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CardHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<CardHit | null>(null)
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [loadingTags, setLoadingTags] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const runSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setStatus(null)
    const res = await searchPrintingsPost(
      { name: query.trim() },
      { groupByCard: true, limit: 24, searchMode: 'broad' },
    )
    setSearching(false)
    if (res.success) {
      setResults(res.data.printings.map(toHit))
    } else {
      setResults([])
      setStatus(`Search failed: ${res.error}`)
    }
  }, [query])

  const selectCard = useCallback(async (card: CardHit) => {
    setSelected(card)
    setStatus(null)
    setLoadingTags(true)
    const res = await fetch(
      `/api/admin/card-facets?cardUniqueId=${encodeURIComponent(card.cardUniqueId)}`,
    )
    const json = await res.json()
    setLoadingTags(false)
    if (res.ok && json.success) {
      setTags(new Set(json.data as string[]))
    } else {
      setTags(new Set())
      setStatus(`Could not load tags: ${json.error ?? res.status}`)
    }
  }, [])

  const toggle = (id: string) => {
    setTags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setStatus(null)
    const res = await fetch('/api/admin/card-facets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueId: selected.cardUniqueId, tags: [...tags] }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok && json.success) {
      setStatus(`Saved — applied to ${json.data.applied} printing row(s) sharing the name.`)
    } else {
      setStatus(`Save failed: ${json.error ?? res.status}`)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <form onSubmit={runSearch} className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a card by name…"
            className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        <ul className="space-y-1 max-h-[28rem] overflow-y-auto">
          {results.map((card) => (
            <li key={card.cardUniqueId}>
              <button
                onClick={() => selectCard(card)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
                  selected?.cardUniqueId === card.cardUniqueId
                    ? 'bg-blue-100 dark:bg-blue-900/60'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {card.imageUrl ? (
                  <Image src={card.imageUrl} alt="" width={36} height={50} className="rounded" />
                ) : (
                  <span className="w-9 h-[50px] rounded bg-gray-200 dark:bg-gray-700" />
                )}
                <span>
                  {card.name}
                  {card.pitch != null && (
                    <span className="text-gray-600 dark:text-gray-400"> · pitch {card.pitch}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {!selected ? (
          <p className="text-gray-600 dark:text-gray-300">Select a card to edit its facet tags.</p>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              {selected.imageUrl && (
                <Image src={selected.imageUrl} alt="" width={48} height={67} className="rounded" />
              )}
              <h2 className="text-xl font-bold">{selected.name}</h2>
            </div>

            {loadingTags ? (
              <p className="text-gray-600 dark:text-gray-300">Loading tags…</p>
            ) : (
              <>
                {DIM_ORDER.map((dim) => {
                  const dimTags = facetTags.filter((t) => t.dim === dim)
                  if (dimTags.length === 0) return null
                  return (
                    <fieldset key={dim} className="mb-5">
                      <legend className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                        {DIM_LABEL[dim]}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {dimTags.map((t) => {
                          const on = tags.has(t.id)
                          return (
                            <button
                              key={t.id}
                              type="button"
                              title={t.def}
                              onClick={() => toggle(t.id)}
                              className={`px-3 py-1.5 rounded-full text-sm border focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
                                on
                                  ? 'bg-green-100 text-green-800 border-green-500 dark:bg-green-900/60 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {on ? '✓ ' : ''}
                              {t.label}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )
                })}

                <button
                  onClick={save}
                  disabled={saving}
                  className="mt-2 px-5 py-2 rounded-md bg-green-600 text-white text-sm font-semibold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                >
                  {saving ? 'Saving…' : 'Save tags'}
                </button>
              </>
            )}
          </div>
        )}
        {status && (
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-200" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────── Filter mode ─────────────────

function FilterMode({ facetTags }: { facetTags: FacetTag[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<CardHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const run = async () => {
    if (selected.size === 0) {
      setStatus('Pick at least one facet to filter by.')
      return
    }
    setLoading(true)
    setStatus(null)
    const res = await searchPrintingsPost(
      { facetTags: [...selected] },
      { groupByCard: true, limit: 60 },
    )
    setLoading(false)
    if (res.success) {
      setResults(res.data.printings.map(toHit))
      setTotal(res.data.total)
    } else {
      setResults([])
      setStatus(`Search failed: ${res.error}`)
    }
  }

  return (
    <div>
      {DIM_ORDER.map((dim) => {
        const dimTags = facetTags.filter((t) => t.dim === dim)
        if (dimTags.length === 0) return null
        return (
          <fieldset key={dim} className="mb-4">
            <legend className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              {DIM_LABEL[dim]}
            </legend>
            <div className="flex flex-wrap gap-2">
              {dimTags.map((t) => {
                const on = selected.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.def}
                    onClick={() => toggle(t.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
                      on
                        ? 'bg-blue-100 text-blue-800 border-blue-500 dark:bg-blue-900/60 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {t.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      <button
        onClick={run}
        disabled={loading}
        className="mb-6 px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
      >
        {loading ? 'Searching…' : 'Search cards (matches ANY selected facet)'}
      </button>

      {status && (
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-200" role="status">
          {status}
        </p>
      )}

      {results.length > 0 && (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{total} card(s)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {results.map((card) => (
              <div key={card.cardUniqueId} className="text-center">
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    width={150}
                    height={209}
                    className="rounded-lg w-full h-auto"
                  />
                ) : (
                  <div className="aspect-[150/209] rounded-lg bg-gray-200 dark:bg-gray-700" />
                )}
                <p className="text-xs mt-1 text-gray-700 dark:text-gray-300">{card.name}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

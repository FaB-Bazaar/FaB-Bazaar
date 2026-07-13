'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, X, Loader2, Search, ChevronDown, LogIn, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCardSearch } from '@/hooks/search/useCardSearch'
import { useOptSearchState } from '@/hooks/search/useOptSearchState'
import { useToast } from '@/hooks/use-toast'
import { buildFilterFacets, Popover, ActiveChip, MatchModeToggle, type FacetDef } from '@/components/search/card-filter-facets'
import { optStateToChips } from '@/lib/search/opt-state-describe'

type Dim = 'mechanical' | 'strategic' | 'synergy'
interface TagDef extends FacetDef { dim: Dim; draft: boolean; cardCount: number }
interface CommunityTag { tag: string; votes: number; votedByMe: boolean }
interface SummaryTag { tag: string; votes: number; live: boolean; mine: boolean }

const DIM_ORDER: Dim[] = ['mechanical', 'strategic', 'synergy']
const DIM_LABEL: Record<Dim, string> = {
  mechanical: 'Mechanical — what the text does',
  strategic: 'Strategic — how it is used',
  synergy: 'Synergy — named packages / lines',
}
const VOTE_THRESHOLD = 2
const SIGN_IN_HREF = '/auth/login?callbackUrl=%2Fcard-facets'

export function PublicCardFacetsClient({ isSignedIn }: { isSignedIn: boolean }) {
  const { toast } = useToast()

  // ── Full /opt search state: every filter, URL-shareable, shorthand queries.
  // Facet selection lives in state.selectedFacets so it rides the same URL sync
  // and active-chips machinery as class/set/pitch — narrow to a niche (e.g.
  // "young Ninja attacks from OUT"), then tag it.
  const { state, dispatch, filters, hasAnyFilter, clearAll } = useOptSearchState()
  const { query, selectedFacets, facetsMatchAll, selectedLanguages } = state
  const patch = useCallback(
    (p: Partial<typeof state>) => dispatch({ type: 'PATCH', patch: p }),
    [dispatch],
  )

  // ── vocabulary (public read; curator drafts hidden) ──
  const [defs, setDefs] = useState<TagDef[]>([])
  const [defsLoading, setDefsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/card-facets/tags')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.success) setDefs((j.data as TagDef[]).filter((d) => !d.draft)) })
      .finally(() => { if (alive) setDefsLoading(false) })
    return () => { alive = false }
  }, [])
  const labelFor = useMemo(() => Object.fromEntries(defs.map((d) => [d.id, d.label])), [defs])

  // ── search (always grouped: tags apply per card name) ──
  const { results, total, loading, loadingMore, sentinelRef, hasMore } = useCardSearch({
    filters, languages: selectedLanguages, sortBy: state.sortBy, sortOrder: state.sortOrder,
    groupByCard: true, enabled: hasAnyFilter,
  })

  const cards = useMemo(() => {
    const seen = new Set<string>(); const out: any[] = []
    for (const p of results) { if (!seen.has(p.name)) { seen.add(p.name); out.push(p) } }
    return out
  }, [results])

  // ── shared filter popovers (facets excluded — the rail owns those) ──
  const filterFacets = buildFilterFacets({ state, dispatch, availablePacks: [], facetDefs: defs, exclude: ['facets'] })
  const activeChips = optStateToChips(state, { facetLabels: labelFor }).map((c) => ({
    key: c.key, label: c.label, onRemove: () => dispatch(c.removeAction),
  }))

  // ── per-tile tag badges: batch-fetched summaries, cached per card id ──
  const [summaries, setSummaries] = useState<Record<string, SummaryTag[]>>({})
  const fetchingRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const missing = cards
      .map((c) => c.card_unique_id as string)
      .filter((id) => summaries[id] === undefined && !fetchingRef.current.has(id))
      .slice(0, 100)
    if (!missing.length) return
    missing.forEach((id) => fetchingRef.current.add(id))
    fetch(`/api/card-facets/summary?cardUniqueIds=${missing.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setSummaries((prev) => {
          const next = { ...prev }
          // Cards absent from the response have no tags — cache [] so we don't refetch.
          for (const id of missing) next[id] = (j?.success && j.data[id]) || []
          return next
        })
      })
      .catch(() => { missing.forEach((id) => fetchingRef.current.delete(id)) })
  }, [cards, summaries])

  const invalidateSummary = useCallback((cardUniqueId: string) => {
    fetchingRef.current.delete(cardUniqueId)
    setSummaries((prev) => { const next = { ...prev }; delete next[cardUniqueId]; return next })
  }, [])

  const [editCard, setEditCard] = useState<any | null>(null)

  return (
    <div className="space-y-4">
      {/* ── Command bar: name/shorthand search + full /opt filter popovers ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => patch({ query: e.target.value })}
              placeholder="Card name or syntax — e.g. t:action c:ninja"
              aria-label="Search cards by name"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            />
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums" aria-live="polite">
            {!hasAnyFilter ? 'Pick filters or facets to list cards'
              : loading ? 'Searching…'
              : `${total.toLocaleString()} card${total === 1 ? '' : 's'}${selectedFacets.length > 1 ? (facetsMatchAll ? ' with ALL selected facets' : ' matching ANY selected facet') : ''}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          {filterFacets.map((f) => (
            <Popover key={f.key} label={f.label} count={f.count} align={f.align} panelClassName={f.panelClassName}>
              {f.body}
            </Popover>
          ))}
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-semibold mr-0.5">Active</span>
            {activeChips.map((c) => <ActiveChip key={c.key} label={c.label} onRemove={c.onRemove} />)}
            <button
              onClick={clearAll}
              className="ml-1 inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Left rail: facet vocabulary ── */}
        <aside className="md:w-80 shrink-0 space-y-3">
          {isSignedIn ? (
            <SuggestTagForm defs={defs} toast={toast} />
          ) : (
            <Link
              href={SIGN_IN_HREF}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            >
              <LogIn className="h-4 w-4" /> Sign in to vote &amp; suggest tags
            </Link>
          )}

          <FacetRail
            defs={defs}
            loading={defsLoading}
            selected={selectedFacets}
            onToggle={(id) => dispatch({ type: 'TOGGLE_IN', key: 'selectedFacets', value: id })}
            matchAll={facetsMatchAll}
            onSetMatchAll={(all) => patch({ facetsMatchAll: all })}
          />
        </aside>

        {/* ── Right grid (dense — click a card for full text + voting) ── */}
        <div className="flex-1 min-w-0">
          {!hasAnyFilter ? (
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Select facets on the left — or narrow with the filters above (class, set, pitch, …) to find
              a niche worth tagging.
            </p>
          ) : loading ? (
            <p className="text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>
          ) : cards.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-300 mt-2">No cards match.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {cards.map((card) => (
                  <button
                    key={card.card_unique_id}
                    onClick={() => setEditCard(card)}
                    title={`${card.name} — click for full text & tags`}
                    // flex-col + justify-start: grid rows stretch tiles to the row's
                    // tallest item, and a stretched <button> vertically CENTERS its
                    // content (UA styling) — images drifted down on tiles with fewer
                    // badge lines. Top-anchor the column instead.
                    className="text-left group flex flex-col justify-start focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none rounded-lg"
                  >
                    {/* Fixed 5:7 box — source images vary slightly in intrinsic
                        ratio, and h-auto tiles drift out of row alignment. */}
                    <div className="aspect-[5/7] rounded-md overflow-hidden bg-gray-200 dark:bg-gray-700">
                      {card.image_url && (
                        <Image src={card.image_url} alt={card.name} width={200} height={280} className="w-full h-full object-cover group-hover:ring-2 group-hover:ring-blue-400" />
                      )}
                    </div>
                    <p className="text-[11px] leading-tight mt-1 text-gray-700 dark:text-gray-300 truncate">{card.name}</p>
                    <TileBadges tags={summaries[card.card_unique_id]} labelFor={labelFor} />
                  </button>
                ))}
              </div>
              {hasMore && <div ref={sentinelRef} className="h-12 flex items-center justify-center text-gray-600">{loadingMore ? 'Loading…' : ''}</div>}
            </>
          )}
        </div>
      </div>

      {editCard && (
        <CardVoteEditor
          card={editCard}
          defs={defs}
          isSignedIn={isSignedIn}
          summary={summaries[editCard.card_unique_id]}
          onClose={() => setEditCard(null)}
          onChanged={() => invalidateSummary(editCard.card_unique_id)}
          toast={toast}
        />
      )}
    </div>
  )
}

// ── Tile badges: compact — up to 2 tags + overflow count ─────────────────────
// Shows globally-live tags (blue) AND the viewer's own sub-threshold votes
// (green) — your tags are always true for you, so the grid must reflect that.
function TileBadges({ tags, labelFor }: { tags?: SummaryTag[]; labelFor: Record<string, string> }) {
  if (!tags?.length) return null
  const visible = tags.filter((t) => t.live || t.mine)
  if (!visible.length) return null
  const shown = visible.slice(0, 2)
  return (
    <span className="mt-0.5 flex flex-wrap gap-0.5">
      {shown.map((t) => (
        <span
          key={t.tag}
          title={t.live ? undefined : 'Your tag — live for you, pending for everyone else'}
          className={cn(
            'inline-flex items-center gap-0.5 px-1 py-px rounded border text-[9px] leading-tight truncate max-w-full',
            t.live
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200'
              : 'bg-green-50 dark:bg-green-950/60 border-green-300 dark:border-green-800 text-green-700 dark:text-green-200',
          )}
        >
          {labelFor[t.tag] ?? t.tag}
          {t.votes > 0 && <span className="font-semibold">·{t.votes}</span>}
        </span>
      ))}
      {visible.length > shown.length && (
        <span className="text-[9px] leading-tight text-gray-500 dark:text-gray-400 self-center">+{visible.length - shown.length}</span>
      )}
    </span>
  )
}

// ── Facet vocabulary rail ────────────────────────────────────────────────────
function FacetRail({
  defs, loading, selected, onToggle, matchAll, onSetMatchAll,
}: {
  defs: TagDef[]; loading: boolean; selected: string[]; onToggle: (id: string) => void;
  matchAll: boolean; onSetMatchAll: (all: boolean) => void;
}) {
  const [q, setQ] = useState('')
  const [closedDims, setClosedDims] = useState<Set<Dim>>(new Set())
  const needle = q.trim().toLowerCase()
  const matches = (d: TagDef) =>
    !needle || d.label.toLowerCase().includes(needle) || d.id.includes(needle) || d.def.toLowerCase().includes(needle)

  const toggleDim = (dim: Dim) =>
    setClosedDims((prev) => { const n = new Set(prev); n.has(dim) ? n.delete(dim) : n.add(dim); return n })

  if (loading) return <p className="text-sm text-gray-600 dark:text-gray-300">Loading tags…</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter tags…"
            aria-label="Filter facet tags"
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          />
        </div>
        <MatchModeToggle matchAll={matchAll} onSetMatchAll={onSetMatchAll} />
      </div>

      {DIM_ORDER.map((dim) => {
        const group = defs.filter((d) => d.dim === dim && matches(d)).sort((a, b) => b.cardCount - a.cardCount || a.label.localeCompare(b.label))
        if (!group.length) return null
        const open = !closedDims.has(dim)
        return (
          <div key={dim}>
            <button
              onClick={() => toggleDim(dim)}
              aria-expanded={open}
              className="w-full flex items-center justify-between text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none rounded"
            >
              {DIM_LABEL[dim]}
              <ChevronDown className={cn('w-4 h-4 transition-transform', !open && '-rotate-90')} />
            </button>
            {open && (
              <ul className="space-y-1">
                {group.map((d) => {
                  const active = selected.includes(d.id)
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => onToggle(d.id)}
                        aria-pressed={active}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-md border focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
                          active
                            ? 'bg-blue-100 border-blue-500 dark:bg-blue-900/60'
                            : 'bg-gray-50 border-gray-200 dark:bg-gray-800/60 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500',
                        )}
                      >
                        <span className={cn('flex items-center justify-between text-sm', active ? 'text-blue-800 dark:text-blue-200 font-medium' : 'text-gray-800 dark:text-gray-200')}>
                          <span>{active ? '✓ ' : ''}{d.label}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({d.cardCount})</span>
                        </span>
                        {d.def && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5 line-clamp-2">{d.def}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
      {defs.length > 0 && defs.every((d) => !matches(d)) && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No tags match “{q}”.</p>
      )}
    </div>
  )
}

// ── Suggest-a-tag form (signed-in only; rendered behind the gate) ────────────
function SuggestTagForm({ defs, toast }: { defs: TagDef[]; toast: ReturnType<typeof useToast>['toast'] }) {
  const [open, setOpen] = useState(false)
  const [dim, setDim] = useState<Dim>('mechanical')
  const [label, setLabel] = useState('')
  const [def, setDef] = useState('')
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await fetch('/api/card-facets/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dim, label: label.trim(), def: def.trim(), rationale: rationale.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok && json.success) {
      toast({ title: 'Suggestion sent for review', description: label.trim() })
      setLabel(''); setDef(''); setRationale(''); setOpen(false)
    } else {
      toast({ title: 'Could not send suggestion', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-semibold bg-green-600 text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
      >
        <Plus className="h-4 w-4" /> Suggest a tag
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Suggest a tag</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">A curator reviews new tags before they go live.</p>
      <select value={dim} onChange={(e) => setDim(e.target.value as Dim)}
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
        {DIM_ORDER.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (e.g. Combo enabler)" required
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <textarea value={def} onChange={(e) => setDef(e.target.value)} placeholder="what does it mean? (optional)" rows={2}
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="why is it needed? (optional)" rows={2}
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <button type="submit" disabled={busy || !label.trim()}
        className="w-full px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-600 text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
        {busy ? 'Sending…' : 'Send suggestion'}
      </button>
      {defs.some((d) => d.label.toLowerCase() === label.trim().toLowerCase()) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">A tag with this label already exists.</p>
      )}
    </form>
  )
}

// ── Per-card editor (modal): full card text + voting ─────────────────────────
function CardVoteEditor({ card, defs, isSignedIn, summary, onClose, onChanged, toast }: {
  card: any; defs: TagDef[]; isSignedIn: boolean; summary?: SummaryTag[]
  onClose: () => void; onChanged: () => void
  toast: ReturnType<typeof useToast>['toast']
}) {
  // Curator-assigned tags are live with zero community votes — they only exist
  // in the projection summary, not the vote table, so surface them from there.
  const curated = useMemo(
    () => new Set((summary ?? []).filter((t) => t.live && t.votes === 0).map((t) => t.tag)),
    [summary],
  )
  const [byTag, setByTag] = useState<Record<string, CommunityTag>>({})
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/card-facets?cardUniqueId=${encodeURIComponent(card.card_unique_id)}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success) {
      const map: Record<string, CommunityTag> = {}
      for (const t of json.data as CommunityTag[]) map[t.tag] = t
      setByTag(map)
    }
    setLoading(false)
  }, [card.card_unique_id])
  useEffect(() => { load() }, [load])

  // Close on Escape (in addition to backdrop click + the X button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = async (tag: string) => {
    if (!isSignedIn) return // buttons are disabled; belt-and-suspenders
    const cur = byTag[tag] ?? { tag, votes: 0, votedByMe: false }
    const add = !cur.votedByMe
    setPending(tag)
    setByTag((prev) => ({ ...prev, [tag]: { tag, votes: cur.votes + (add ? 1 : -1), votedByMe: add } }))
    const res = await fetch('/api/card-facets/assign', {
      method: add ? 'POST' : 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueId: card.card_unique_id, tag }),
    })
    const json = await res.json().catch(() => ({}))
    setPending(null)
    if (res.ok && json.success) {
      setByTag((prev) => ({ ...prev, [tag]: { tag, votes: json.data.votes, votedByMe: add } }))
      onChanged()
    } else {
      setByTag((prev) => ({ ...prev, [tag]: cur }))
      toast({ title: 'Vote failed', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  // Card text is stored with markdown markers (**bold**, _italic_) — strip them
  // for the plain-text modal rather than pulling in a renderer.
  const cleanText = (card.text as string | undefined)?.replace(/\*\*/g, '').replace(/_\(/g, '(').replace(/\)_/g, ')').replace(/(^|\s)_|_(\s|$)/g, '$1$2')

  // Stat line pieces present on grouped search rows (nulls skipped).
  const stats = [
    card.pitch != null && `Pitch ${card.pitch}`,
    card.cost != null && `Cost ${card.cost}`,
    card.power != null && `Power ${card.power}`,
    card.defense != null && `Defense ${card.defense}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-bold">{card.name}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"><X className="h-5 w-5" /></button>
        </div>

        {/* Full card: image + rules text */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {card.image_url && (
            <Image src={card.image_url} alt={card.name} width={220} height={307} className="rounded-lg w-40 sm:w-52 h-auto shrink-0 self-start" />
          )}
          <div className="min-w-0 text-sm space-y-2">
            {card.type_text_display && (
              <p className="font-semibold text-gray-700 dark:text-gray-200">{card.type_text_display}</p>
            )}
            {stats && <p className="text-xs text-gray-600 dark:text-gray-400">{stats}</p>}
            {cleanText && (
              <p className="whitespace-pre-line text-gray-800 dark:text-gray-200">{cleanText}</p>
            )}
            {card.flavor_text && (
              <p className="italic text-gray-500 dark:text-gray-400">{card.flavor_text}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Votes apply to every printing of this card. A tag goes live for everyone at {VOTE_THRESHOLD}+ votes —
              but your own tags always count in <em>your</em> searches immediately.
            </p>
          </div>
        </div>

        {!isSignedIn && (
          <p className="mb-4 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
            <Link href={SIGN_IN_HREF} className="font-semibold underline">Sign in</Link> to vote on this card&rsquo;s tags.
          </p>
        )}

        {loading ? (
          <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading tags…</p>
        ) : (
          DIM_ORDER.map((dim) => {
            const group = defs.filter((d) => d.dim === dim)
            if (!group.length) return null
            return (
              <fieldset key={dim} className="mb-4">
                <legend className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">{DIM_LABEL[dim]}</legend>
                <div className="flex flex-wrap gap-2">
                  {group.map((d) => {
                    const ct = byTag[d.id]
                    const votes = ct?.votes ?? 0
                    const mine = ct?.votedByMe ?? false
                    const isCurated = curated.has(d.id)
                    const live = isCurated || votes >= VOTE_THRESHOLD
                    return (
                      <button
                        key={d.id}
                        type="button"
                        title={isSignedIn ? d.def : `${d.def ? d.def + ' — ' : ''}Sign in to vote`}
                        disabled={!isSignedIn || pending === d.id}
                        onClick={() => toggle(d.id)}
                        aria-pressed={mine}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
                          !isSignedIn && 'cursor-default',
                          pending === d.id && 'opacity-50',
                          mine
                            ? 'bg-green-100 text-green-800 border-green-500 dark:bg-green-900/60 dark:text-green-200'
                            : isCurated
                              ? 'bg-blue-50 text-blue-800 border-blue-400 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700'
                              : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
                        )}
                      >
                        {mine ? '✓ ' : ''}{d.label}
                        {isCurated && (
                          <span title="Curator-assigned — always live in search" className="ml-0.5 px-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                            curated
                          </span>
                        )}
                        {votes > 0 && (
                          <span
                            title={live ? 'Live in search' : `Needs ${VOTE_THRESHOLD - votes} more to go live`}
                            className={cn(
                              'ml-0.5 px-1.5 rounded-full text-xs font-semibold',
                              live ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-100',
                            )}
                          >
                            {votes}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })
        )}
      </div>
    </div>
  )
}

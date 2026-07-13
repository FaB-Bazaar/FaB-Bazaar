'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { Trash2, Plus, X, Loader2 } from 'lucide-react'
import { useCardSearch } from '@/hooks/search/useCardSearch'
import { useToast } from '@/hooks/use-toast'
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService'

type Dim = 'mechanical' | 'strategic' | 'synergy'
interface TagDef { id: string; dim: Dim; label: string; def: string; draft: boolean; cardCount: number }

const DIM_ORDER: Dim[] = ['mechanical', 'strategic', 'synergy']
const DIM_LABEL: Record<Dim, string> = {
  mechanical: 'Mechanical — what the text does',
  strategic: 'Strategic — how it is used',
  synergy: 'Synergy — named packages / lines',
}

export function CardFacetsClient() {
  const { toast } = useToast()

  // ── vocabulary ──
  const [defs, setDefs] = useState<TagDef[]>([])
  const [defsLoading, setDefsLoading] = useState(true)

  const loadDefs = useCallback(async () => {
    const res = await fetch('/api/admin/card-facets/tags')
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success) setDefs(json.data as TagDef[])
    setDefsLoading(false)
  }, [])
  useEffect(() => { loadDefs() }, [loadDefs])

  // ── filter / search state ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [nameInput, setNameInput] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setNameQuery(nameInput), 300)
    return () => clearTimeout(t)
  }, [nameInput])

  const selectedKey = [...selected].sort().join(',')
  const filters = useMemo<PrintingsSearchFilters>(() => {
    const f: PrintingsSearchFilters = {}
    if (selected.size) f.facetTags = [...selected]
    if (nameQuery.trim()) f.name = nameQuery.trim()
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, nameQuery])

  const enabled = selected.size > 0 || nameQuery.trim().length > 0
  const { results, total, loading, loadingMore, sentinelRef, hasMore } = useCardSearch({
    filters, languages: ['en'], sortBy: 'name', sortOrder: 'asc', groupByCard: true, enabled,
  })

  // one tile per card name (tags apply per name)
  const cards = useMemo(() => {
    const seen = new Set<string>(); const out: any[] = []
    for (const p of results) { if (!seen.has(p.name)) { seen.add(p.name); out.push(p) } }
    return out
  }, [results])

  const toggleFilter = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── create / delete tag ──
  const deleteTag = async (id: string) => {
    const res = await fetch(`/api/admin/card-facets/tags?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success) {
      toast({ title: 'Tag deleted', description: id })
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
      loadDefs()
    } else {
      toast({ title: 'Could not delete tag', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  // ── per-card editor ──
  const [editCard, setEditCard] = useState<any | null>(null)

  return (
    <>
    <SuggestionsPanel onApproved={loadDefs} toast={toast} />
    <div className="flex flex-col md:flex-row gap-6">
      {/* ── Left rail ── */}
      <aside className="md:w-72 shrink-0 space-y-4">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Filter by card name…"
          className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
        />

        <NewTagForm defs={defs} onCreated={loadDefs} toast={toast} />

        {defsLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading tags…</p>
        ) : (
          DIM_ORDER.map((dim) => {
            const group = defs.filter((d) => d.dim === dim)
            if (!group.length) return null
            return (
              <div key={dim}>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">{DIM_LABEL[dim]}</h3>
                <ul className="space-y-1">
                  {group.map((d) => (
                    <li key={d.id} className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFilter(d.id)}
                        title={d.def}
                        className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-sm border focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
                          selected.has(d.id)
                            ? 'bg-blue-100 text-blue-800 border-blue-500 dark:bg-blue-900/60 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selected.has(d.id) ? '✓ ' : ''}{d.label}
                        <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">({d.cardCount})</span>
                      </button>
                      <button
                        onClick={() => deleteTag(d.id)}
                        disabled={d.cardCount > 0}
                        title={d.cardCount > 0 ? 'Unassign from all cards before deleting' : `Delete ${d.label}`}
                        aria-label={`Delete ${d.label}`}
                        className="p-1.5 rounded-md text-gray-600 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </aside>

      {/* ── Right grid ── */}
      <div className="flex-1 min-w-0">
        {!enabled ? (
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Select one or more facets, or type a card name, to list cards.
          </p>
        ) : loading ? (
          <p className="text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>
        ) : cards.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300 mt-2">No cards match.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{total} card(s){selected.size ? ' matching ANY selected facet' : ''}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {cards.map((card) => (
                <button
                  key={card.card_unique_id}
                  onClick={() => setEditCard(card)}
                  className="text-left group focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none rounded-lg"
                >
                  {card.image_url ? (
                    <Image src={card.image_url} alt={card.name} width={300} height={418} className="rounded-lg w-full h-auto group-hover:ring-2 group-hover:ring-blue-400" />
                  ) : (
                    <div className="aspect-[5/7] rounded-lg bg-gray-200 dark:bg-gray-700" />
                  )}
                  <p className="text-xs mt-1 text-gray-700 dark:text-gray-300 truncate">{card.name}</p>
                </button>
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="h-12 flex items-center justify-center text-gray-600">{loadingMore ? 'Loading…' : ''}</div>}
          </>
        )}
      </div>

      {editCard && (
        <CardEditor
          card={editCard}
          defs={defs}
          onClose={() => setEditCard(null)}
          onChanged={loadDefs}
          toast={toast}
        />
      )}
    </div>
    </>
  )
}

// ── Suggestions review queue (admin) ───────────────────────────────────────
interface Suggestion {
  id: string; proposedId: string | null; dim: Dim; label: string; def: string;
  rationale: string; proposedBy: string; status: string
}

function SuggestionsPanel({ onApproved, toast }: { onApproved: () => void; toast: ReturnType<typeof useToast>['toast'] }) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [slugEdits, setSlugEdits] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/card-facets/suggestions?status=pending')
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success) setItems(json.data as Suggestion[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (s: Suggestion, action: 'approve' | 'reject') => {
    setBusy(s.id)
    const slug = (slugEdits[s.id] ?? s.proposedId ?? '').trim()
    const body: any = { id: s.id, action }
    if (action === 'approve' && slug) body.overrides = { id: slug }
    const res = await fetch('/api/admin/card-facets/suggestions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (res.ok && json.success) {
      toast({ title: action === 'approve' ? 'Suggestion approved' : 'Suggestion rejected', description: s.label })
      setItems((prev) => prev.filter((i) => i.id !== s.id))
      if (action === 'approve') onApproved()
    } else {
      toast({ title: `Could not ${action}`, description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="mb-6 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
      <h2 className="text-lg font-bold mb-3 text-amber-900 dark:text-amber-200">
        Suggested tags — {items.length} pending review
      </h2>
      <ul className="space-y-3">
        {items.map((s) => (
          <li key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {s.label} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({s.dim})</span>
              </p>
              {s.def && <p className="text-xs text-gray-600 dark:text-gray-300">{s.def}</p>}
              {s.rationale && <p className="text-xs italic text-gray-500 dark:text-gray-400">“{s.rationale}”</p>}
            </div>
            <input
              value={slugEdits[s.id] ?? s.proposedId ?? ''}
              onChange={(e) => setSlugEdits((p) => ({ ...p, [s.id]: e.target.value }))}
              placeholder="final-slug"
              aria-label={`Final slug for ${s.label}`}
              className="w-40 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            />
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => act(s, 'approve')}
                disabled={busy === s.id}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-green-600 text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
              >
                Approve
              </button>
              <button
                onClick={() => act(s, 'reject')}
                disabled={busy === s.id}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── New tag form ──────────────────────────────────────────────────────────
function NewTagForm({ defs, onCreated, toast }: { defs: TagDef[]; onCreated: () => void; toast: ReturnType<typeof useToast>['toast'] }) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('')
  const [dim, setDim] = useState<Dim>('mechanical')
  const [label, setLabel] = useState('')
  const [def, setDef] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await fetch('/api/admin/card-facets/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id.trim(), dim, label: label.trim(), def: def.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok && json.success) {
      toast({ title: 'Tag created', description: id.trim() })
      setId(''); setLabel(''); setDef(''); setOpen(false); onCreated()
    } else {
      toast({ title: 'Could not create tag', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-semibold bg-green-600 text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
      >
        <Plus className="h-4 w-4" /> New tag
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">New tag</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"><X className="h-4 w-4" /></button>
      </div>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="id (slug, e.g. combo-enabler)" required
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <select value={dim} onChange={(e) => setDim(e.target.value as Dim)}
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
        {DIM_ORDER.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label (e.g. Combo enabler)" required
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <textarea value={def} onChange={(e) => setDef(e.target.value)} placeholder="definition (optional)" rows={2}
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none" />
      <button type="submit" disabled={busy}
        className="w-full px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-600 text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
        {busy ? 'Creating…' : 'Create tag'}
      </button>
      {defs.some((d) => d.id === id.trim()) && <p className="text-xs text-amber-600 dark:text-amber-400">A tag with this id already exists.</p>}
    </form>
  )
}

// ── Per-card editor (modal) ─────────────────────────────────────────────────
function CardEditor({ card, defs, onClose, onChanged, toast }: {
  card: any; defs: TagDef[]; onClose: () => void; onChanged: () => void; toast: ReturnType<typeof useToast>['toast']
}) {
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/card-facets?cardUniqueId=${encodeURIComponent(card.card_unique_id)}`)
      .then((r) => r.json()).then((j) => { if (alive && j.success) setTags(new Set(j.data as string[])) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [card.card_unique_id])

  const toggle = async (tag: string) => {
    const has = tags.has(tag)
    setPending(tag)
    // optimistic
    setTags((prev) => { const n = new Set(prev); has ? n.delete(tag) : n.add(tag); return n })
    const res = await fetch('/api/admin/card-facets/assign', {
      method: has ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueId: card.card_unique_id, tag }),
    })
    const json = await res.json().catch(() => ({}))
    setPending(null)
    if (res.ok && json.success) {
      onChanged() // refresh rail counts
    } else {
      // revert
      setTags((prev) => { const n = new Set(prev); has ? n.add(tag) : n.delete(tag); return n })
      toast({ title: 'Update failed', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {card.image_url && <Image src={card.image_url} alt="" width={56} height={78} className="rounded" />}
            <div>
              <h2 className="text-xl font-bold">{card.name}</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Tags apply to every printing of this card.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"><X className="h-5 w-5" /></button>
        </div>

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
                    const on = tags.has(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        title={d.def}
                        disabled={pending === d.id}
                        onClick={() => toggle(d.id)}
                        className={`px-3 py-1.5 rounded-full text-sm border disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none ${
                          on
                            ? 'bg-green-100 text-green-800 border-green-500 dark:bg-green-900/60 dark:text-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {on ? '✓ ' : ''}{d.label}
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

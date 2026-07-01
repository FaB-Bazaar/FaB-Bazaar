'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type {
  HeroLegalityFlag,
  HeroLegalityRow,
} from '@/lib/services/contracts/IPrintingsService'

const FLAGS: { key: HeroLegalityFlag; column: keyof HeroLegalityRow; label: string }[] = [
  { key: 'll_legal', column: 'llLegal', label: 'LL' },
  { key: 'cc_legal', column: 'ccLegal', label: 'CC' },
  { key: 'blitz_legal', column: 'blitzLegal', label: 'Blitz' },
  { key: 'silver_age_legal', column: 'silverAgeLegal', label: 'SA' },
  { key: 'commoner_legal', column: 'commonerLegal', label: 'Com' },
]

function Dot({
  active,
  busy,
  onClick,
  label,
}: {
  active: boolean
  busy: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={
        'inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors disabled:opacity-50 ' +
        (active
          ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600'
          : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800')
      }
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
      ) : active ? (
        <span className="block w-2 h-2 rounded-full bg-white" />
      ) : (
        <span className="block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
    </button>
  )
}

export function HeroLegalityClient({ initial }: { initial: HeroLegalityRow[] }) {
  const { toast } = useToast()
  const [heroes, setHeroes] = useState(initial)
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [previewHero, setPreviewHero] = useState<HeroLegalityRow | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!previewHero) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewHero(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewHero])

  const allClasses = useMemo(() => {
    const set = new Set<string>()
    heroes.forEach(h => { if (h.klass) set.add(h.klass) })
    return Array.from(set).sort()
  }, [heroes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return heroes.filter(h => {
      if (classFilter !== 'all' && h.klass !== classFilter) return false
      if (!q) return true
      return h.displayName.toLowerCase().includes(q) || (h.klass?.toLowerCase().includes(q) ?? false)
    })
  }, [heroes, query, classFilter])

  function patchYoung(hero: HeroLegalityRow) {
    const key = `${hero.cardUniqueId}:young`
    if (pending[key]) return
    const isYoung = hero.types.includes('young')
    const nextValue = !isYoung

    setPending(p => ({ ...p, [key]: true }))
    setHeroes(prev =>
      prev.map(h => {
        if (h.cardUniqueId !== hero.cardUniqueId) return h
        const nextTypes = nextValue
          ? [...h.types.filter(t => t !== 'young'), 'young']
          : h.types.filter(t => t !== 'young')
        return { ...h, types: nextTypes }
      }),
    )

    startTransition(async () => {
      const res = await fetch(`/api/admin/heroes/${hero.cardUniqueId}/young`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: nextValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        setHeroes(prev =>
          prev.map(h => (h.cardUniqueId === hero.cardUniqueId ? { ...h, types: hero.types } : h)),
        )
        toast({
          title: 'Update failed',
          description: data?.error || `HTTP ${res.status}`,
          variant: 'destructive',
        })
      }
      setPending(p => {
        const next = { ...p }
        delete next[key]
        return next
      })
    })
  }

  function patch(hero: HeroLegalityRow, flag: HeroLegalityFlag, column: keyof HeroLegalityRow) {
    const key = `${hero.cardUniqueId}:${flag}`
    if (pending[key]) return
    const nextValue = !(hero[column] as boolean)

    setPending(p => ({ ...p, [key]: true }))
    setHeroes(prev =>
      prev.map(h => (h.cardUniqueId === hero.cardUniqueId ? { ...h, [column]: nextValue } : h)),
    )

    startTransition(async () => {
      const res = await fetch(`/api/admin/heroes/${hero.cardUniqueId}/legality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, value: nextValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        setHeroes(prev =>
          prev.map(h => (h.cardUniqueId === hero.cardUniqueId ? { ...h, [column]: !nextValue } : h)),
        )
        toast({
          title: 'Update failed',
          description: data?.error || `HTTP ${res.status}`,
          variant: 'destructive',
        })
      }
      setPending(p => {
        const next = { ...p }
        delete next[key]
        return next
      })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by hero name or class…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm capitalize"
        >
          <option value="all">All classes</option>
          {allClasses.map(c => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {heroes.length} heroes
        </div>
      </div>

      <div className="border rounded-lg bg-white dark:bg-gray-800">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-left font-medium px-3 py-2 w-20 border-b border-gray-300 dark:border-gray-700">Art</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-left font-medium px-3 py-2 border-b border-gray-300 dark:border-gray-700">Hero</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-left font-medium px-3 py-2 w-32 border-b border-gray-300 dark:border-gray-700">Class</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-center font-medium px-3 py-2 w-16 border-b border-gray-300 dark:border-gray-700">Young</th>
              {FLAGS.map(f => (
                <th key={f.key} className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 text-center font-medium px-2 py-2 w-16 border-b border-gray-300 dark:border-gray-700">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(hero => {
              const isYoung = hero.types.includes('young')
              return (
                <tr key={hero.cardUniqueId} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">
                    {hero.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewHero(hero)}
                        className="block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        aria-label={`Enlarge ${hero.displayName} art`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={hero.imageUrl}
                          alt=""
                          className="w-16 aspect-[5/7] object-contain rounded bg-gray-100 dark:bg-gray-900 hover:opacity-80 transition-opacity cursor-zoom-in"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="w-16 aspect-[5/7] bg-gray-100 dark:bg-gray-900 rounded flex items-center justify-center text-[10px] text-gray-400">
                        no img
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{hero.displayName}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{hero.klass ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => patchYoung(hero)}
                      disabled={!!pending[`${hero.cardUniqueId}:young`]}
                      aria-pressed={isYoung}
                      title={isYoung ? 'Marked Young — click to remove' : 'Not Young — click to mark'}
                      className={
                        'inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium rounded border transition-colors disabled:opacity-50 ' +
                        (isYoung
                          ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60 dark:hover:bg-amber-900/60'
                          : 'bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800')
                      }
                    >
                      {pending[`${hero.cardUniqueId}:young`] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isYoung ? (
                        'Young'
                      ) : (
                        '—'
                      )}
                    </button>
                  </td>
                  {FLAGS.map(({ key, column, label }) => (
                    <td key={key} className="px-2 py-2 text-center">
                      <Dot
                        label={`${label}: ${hero[column] ? 'legal' : 'not legal'}`}
                        active={hero[column] as boolean}
                        busy={!!pending[`${hero.cardUniqueId}:${key}`]}
                        onClick={() => patch(hero, key, column)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {previewHero && previewHero.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${previewHero.displayName} art`}
          onClick={() => setPreviewHero(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewHero.imageUrl}
            alt={previewHero.displayName}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

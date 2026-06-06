'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, Plus } from 'lucide-react'
import type { BannedCardDTO, BannedFormat, RestrictionType } from '@/lib/services/contracts/IBannedCardsService'
import { BanCardSearchDialog } from './BanCardSearchDialog'
import type { BanCardOption } from './card-search-utils'

interface FormatBucket {
  format: BannedFormat
  entries: BannedCardDTO[]
}

export interface CardInfo {
  name: string
  pitch: number | null
  imageUrl: string | null
}

export type CardLookup = Record<string, CardInfo>

// Per-format upstream data availability (mirrors app/api/banned-cards/sync/route.ts).
const SYNC_BUTTONS: Partial<Record<BannedFormat, RestrictionType[]>> = {
  silver_age: ['banned'],
  classic_constructed: ['banned'],
  living_legend: ['banned', 'restricted'],
}

function formatLabel(format: BannedFormat): string {
  return format.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const PITCH_BADGE: Record<number, string> = {
  1: 'border-red-500 text-red-700 dark:text-red-300',
  2: 'border-yellow-500 text-yellow-700 dark:text-yellow-300',
  3: 'border-blue-500 text-blue-700 dark:text-blue-300',
}

interface Props {
  initial: FormatBucket[]
  cardLookup: CardLookup
}

export function BannedCardsClient({ initial, cardLookup: initialLookup }: Props) {
  const [buckets, setBuckets] = useState<FormatBucket[]>(initial)
  const [cardLookup, setCardLookup] = useState<CardLookup>(initialLookup)
  const [filter, setFilter] = useState('')
  const [searchFormat, setSearchFormat] = useState<BannedFormat | null>(null)
  const [pending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState<string | null>(null) // key: `${format}:${restrictionType}`
  const { toast } = useToast()

  // Fetch enrichment for cardUniqueIds not yet in the lookup.
  const enrichMissing = async (entries: BannedCardDTO[]) => {
    const missing = Array.from(
      new Set(entries.map(e => e.cardUniqueId).filter(id => !cardLookup[id])),
    )
    if (missing.length === 0) return
    const res = await fetch(
      `/api/printings/search?cardUniqueIds=${missing.join(',')}&limit=${missing.length * 5}`,
    )
    const body = await res.json()
    const printings: Array<{ card_unique_id: string; name: string; pitch: number | null; image_url: string | null }> =
      body?.data?.printings ?? body?.printings ?? []
    if (printings.length === 0) return
    setCardLookup(prev => {
      const next = { ...prev }
      for (const p of printings) {
        if (!next[p.card_unique_id]) {
          next[p.card_unique_id] = { name: p.name, pitch: p.pitch ?? null, imageUrl: p.image_url ?? null }
        }
      }
      return next
    })
  }

  const refreshBucket = async (format: BannedFormat) => {
    const res = await fetch(`/api/banned-cards?format=${format}&includeInactive=true`)
    const body = await res.json()
    if (!body.success) return
    setBuckets(b => b.map(x => x.format === format ? { format, entries: body.data } : x))
    await enrichMissing(body.data)
  }

  const toggleActive = async (entry: BannedCardDTO) => {
    startTransition(async () => {
      const res = await fetch(`/api/banned-cards/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statusActive: !entry.statusActive }),
      })
      const body = await res.json()
      if (!body.success) {
        toast({ title: 'Update failed', description: body.error, variant: 'destructive' })
        return
      }
      await refreshBucket(entry.format)
    })
  }

  const addCard = async (format: BannedFormat, option: BanCardOption) => {
    // Seed the lookup so the new row renders with its image before the refresh.
    setCardLookup(prev => prev[option.cardUniqueId] ? prev : {
      ...prev,
      [option.cardUniqueId]: { name: option.name, pitch: option.pitch, imageUrl: option.imageUrl },
    })
    setSearchFormat(null)
    startTransition(async () => {
      const res = await fetch('/api/banned-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardUniqueId: option.cardUniqueId, format }),
      })
      const body = await res.json()
      if (!body.success) {
        toast({ title: 'Add failed', description: body.error, variant: 'destructive' })
        return
      }
      await refreshBucket(format)
      toast({ title: `Banned ${option.name || option.cardUniqueId}` })
    })
  }

  const syncFromFab = async (format: BannedFormat, restrictionType: RestrictionType) => {
    const key = `${format}:${restrictionType}`
    setSyncing(key)
    try {
      const res = await fetch('/api/banned-cards/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format, restrictionType }),
      })
      const body = await res.json()
      if (!body.success) {
        toast({ title: 'Sync failed', description: body.error, variant: 'destructive' })
        return
      }
      const { added, updated, deactivated, unchanged } = body.data
      toast({
        title: `Synced ${formatLabel(format)} (${restrictionType})`,
        description: `+${added} added · ${updated} updated · ${deactivated} deactivated · ${unchanged} unchanged`,
      })
      await refreshBucket(format)
    } finally {
      setSyncing(null)
    }
  }

  const visibleBuckets = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return buckets
    return buckets.map(b => ({
      ...b,
      entries: b.entries.filter(e => {
        const name = cardLookup[e.cardUniqueId]?.name?.toLowerCase() ?? ''
        return (
          name.includes(q) ||
          e.cardUniqueId.toLowerCase().includes(q) ||
          (e.sourceUniqueId ?? '').toLowerCase().includes(q)
        )
      }),
    }))
  }, [buckets, filter, cardLookup])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by name, card_unique_id, or source_unique_id..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-md"
      />

      <Tabs defaultValue="silver_age">
        <TabsList className="flex-wrap h-auto">
          {buckets.map(b => (
            <TabsTrigger key={b.format} value={b.format}>
              {formatLabel(b.format)}
              {b.entries.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {b.entries.filter(e => e.statusActive).length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleBuckets.map(bucket => (
          <TabsContent key={bucket.format} value={bucket.format}>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(SYNC_BUTTONS[bucket.format] ?? []).map(rt => {
                const key = `${bucket.format}:${rt}`
                const busy = syncing === key
                return (
                  <Button
                    key={key}
                    variant="outline"
                    onClick={() => syncFromFab(bucket.format, rt)}
                    disabled={syncing !== null}
                  >
                    {busy
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync {rt === 'restricted' ? 'restricted' : 'banned'} from FaB
                  </Button>
                )
              })}
              <div className="flex items-center gap-2 ml-auto">
                <Button onClick={() => setSearchFormat(bucket.format)} disabled={pending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add card
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 w-16">card</th>
                    <th className="text-left p-2">name</th>
                    <th className="text-left p-2">type</th>
                    <th className="text-left p-2">date_in_effect</th>
                    <th className="text-left p-2">status</th>
                    <th className="text-right p-2">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.entries.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No entries</td></tr>
                  ) : bucket.entries.map(e => {
                    const info = cardLookup[e.cardUniqueId]
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="p-2">
                          {info?.imageUrl ? (
                            <Image
                              src={info.imageUrl}
                              alt={info.name}
                              width={40}
                              height={56}
                              className="rounded-sm object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-10 h-14 bg-muted rounded-sm" />
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{info?.name ?? '—'}</span>
                            {info?.pitch != null && (
                              <Badge variant="secondary" className={PITCH_BADGE[info.pitch] ?? ''}>
                                {info.pitch}
                              </Badge>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {e.cardUniqueId}
                            {e.sourceUniqueId && <span className="ml-2">· src: {e.sourceUniqueId}</span>}
                          </div>
                        </td>
                        <td className="p-2">
                          {e.restrictionType === 'restricted'
                            ? <Badge variant="secondary" className="border-orange-500 text-orange-700 dark:text-orange-300">restricted (1)</Badge>
                            : <Badge variant="destructive">banned</Badge>}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{e.dateInEffect?.slice(0, 10) ?? '—'}</td>
                        <td className="p-2">
                          {e.statusActive
                            ? <Badge>active</Badge>
                            : <Badge variant="secondary">inactive</Badge>}
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => toggleActive(e)} disabled={pending}>
                            {e.statusActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <BanCardSearchDialog
        open={searchFormat !== null}
        onOpenChange={open => { if (!open) setSearchFormat(null) }}
        formatLabel={searchFormat ? formatLabel(searchFormat) : ''}
        onSelect={option => { if (searchFormat) addCard(searchFormat, option) }}
      />
    </div>
  )
}

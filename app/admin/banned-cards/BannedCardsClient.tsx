'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, Plus } from 'lucide-react'
import type { BannedCardDTO, BannedFormat } from '@/lib/services/contracts/IBannedCardsService'

interface FormatBucket {
  format: BannedFormat
  entries: BannedCardDTO[]
}

// Formats we actually have upstream data for (mirrors app/api/banned-cards/sync/route.ts).
const SYNCABLE_FORMATS: BannedFormat[] = ['silver_age', 'classic_constructed']

function formatLabel(format: BannedFormat): string {
  return format.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function BannedCardsClient({ initial }: { initial: FormatBucket[] }) {
  const [buckets, setBuckets] = useState<FormatBucket[]>(initial)
  const [filter, setFilter] = useState('')
  const [newCardId, setNewCardId] = useState<Record<BannedFormat, string>>({} as any)
  const [pending, startTransition] = useTransition()
  const [syncingFormat, setSyncingFormat] = useState<BannedFormat | null>(null)
  const { toast } = useToast()

  const refreshBucket = async (format: BannedFormat) => {
    const res = await fetch(`/api/banned-cards?format=${format}&includeInactive=true`)
    const body = await res.json()
    if (!body.success) return
    setBuckets(b => b.map(x => x.format === format ? { format, entries: body.data } : x))
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

  const addEntry = async (format: BannedFormat) => {
    const cardUniqueId = newCardId[format]?.trim()
    if (!cardUniqueId) {
      toast({ title: 'Missing card_unique_id', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/banned-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardUniqueId, format }),
      })
      const body = await res.json()
      if (!body.success) {
        toast({ title: 'Add failed', description: body.error, variant: 'destructive' })
        return
      }
      setNewCardId(prev => ({ ...prev, [format]: '' }))
      await refreshBucket(format)
      toast({ title: 'Banned card added' })
    })
  }

  const syncFromFab = async (format: BannedFormat) => {
    setSyncingFormat(format)
    try {
      const res = await fetch('/api/banned-cards/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format }),
      })
      const body = await res.json()
      if (!body.success) {
        toast({ title: 'Sync failed', description: body.error, variant: 'destructive' })
        return
      }
      const { added, updated, deactivated, unchanged } = body.data
      toast({
        title: `Synced ${formatLabel(format)}`,
        description: `+${added} added · ${updated} updated · ${deactivated} deactivated · ${unchanged} unchanged`,
      })
      await refreshBucket(format)
    } finally {
      setSyncingFormat(null)
    }
  }

  const visibleBuckets = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return buckets
    return buckets.map(b => ({
      ...b,
      entries: b.entries.filter(e =>
        e.cardUniqueId.toLowerCase().includes(q) ||
        (e.sourceUniqueId ?? '').toLowerCase().includes(q),
      ),
    }))
  }, [buckets, filter])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by card_unique_id or source_unique_id..."
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
            <div className="flex items-center gap-2 mb-4">
              {SYNCABLE_FORMATS.includes(bucket.format) && (
                <Button
                  variant="outline"
                  onClick={() => syncFromFab(bucket.format)}
                  disabled={syncingFormat === bucket.format}
                >
                  {syncingFormat === bucket.format
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync from FaB
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  placeholder="card_unique_id"
                  value={newCardId[bucket.format] ?? ''}
                  onChange={e => setNewCardId(prev => ({ ...prev, [bucket.format]: e.target.value }))}
                  className="w-[280px]"
                />
                <Button onClick={() => addEntry(bucket.format)} disabled={pending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">card_unique_id</th>
                    <th className="text-left p-2">source_unique_id</th>
                    <th className="text-left p-2">date_in_effect</th>
                    <th className="text-left p-2">status</th>
                    <th className="text-right p-2">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.entries.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No entries</td></tr>
                  ) : bucket.entries.map(e => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2 font-mono text-xs">{e.cardUniqueId}</td>
                      <td className="p-2 font-mono text-xs text-muted-foreground">{e.sourceUniqueId ?? '—'}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

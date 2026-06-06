'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'
import { groupPrintingsToCardOptions, type BanCardOption } from './card-search-utils'

const PITCH_BADGE: Record<number, string> = {
  1: 'border-red-500 text-red-700 dark:text-red-300',
  2: 'border-yellow-500 text-yellow-700 dark:text-yellow-300',
  3: 'border-blue-500 text-blue-700 dark:text-blue-300',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  formatLabel: string
  onSelect: (option: BanCardOption) => void
}

export function BanCardSearchDialog({ open, onOpenChange, formatLabel, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [options, setOptions] = useState<BanCardOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebounced('')
      setOptions([])
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const q = debounced.trim()
    if (q.length < 3) {
      setOptions([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      name: q,
      limit: '50',
      sortBy: 'name',
      sortOrder: 'asc',
      show: 'summary',
      searchMode: 'strict',
    })

    fetch(`/api/printings/search?${params.toString()}`)
      .then(res => res.json())
      .then(body => {
        if (cancelled) return
        const printings = body?.data?.printings ?? body?.printings ?? []
        if (!body.success && !printings.length) {
          setError(body.error || 'Search failed')
          setOptions([])
          return
        }
        setOptions(groupPrintingsToCardOptions(printings))
      })
      .catch(() => {
        if (!cancelled) {
          setError('Search failed. Please try again.')
          setOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debounced])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add banned card — {formatLabel}</DialogTitle>
          <DialogDescription>
            Search by card name and pick the exact card (pitch) to ban.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by card name..."
            className="pl-8"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Searching…
            </div>
          ) : error ? (
            <div className="text-center py-10 text-destructive text-sm">{error}</div>
          ) : options.length > 0 ? (
            <ul className="space-y-1">
              {options.map(opt => (
                <li key={opt.cardUniqueId}>
                  <button
                    type="button"
                    onClick={() => onSelect(opt)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {opt.imageUrl ? (
                      <Image
                        src={opt.imageUrl}
                        alt={opt.name}
                        width={36}
                        height={50}
                        className="rounded-sm object-cover shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-9 h-[50px] bg-muted rounded-sm shrink-0" />
                    )}
                    <span className="font-medium">{opt.name || '—'}</span>
                    {opt.pitch != null && (
                      <Badge variant="secondary" className={PITCH_BADGE[opt.pitch] ?? ''}>
                        {opt.pitch}
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {opt.cardUniqueId}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : debounced.trim().length >= 3 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No cards found matching “{debounced}”
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Type at least 3 characters to search
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

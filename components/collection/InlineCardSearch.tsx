// components/collection/InlineCardSearch.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X } from "lucide-react"
import { bindersClient } from "@/lib/client"
import type { CardSearchResultDTO } from "@/lib/services/contracts/IBinderService"

export function InlineCardSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CardSearchResultDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const result = await bindersClient.searchCollectionCards(query)
      setLoading(false)
      if (result.success) {
        setResults(result.data)
        setOpen(true)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const totalCopies = results.reduce(
    (sum, r) => sum + r.locations.reduce((s, l) => s + l.quantity, 0),
    0
  )

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search across all your cards..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-9 pr-8"
          aria-label="Search cards across all binders"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No cards found for &ldquo;{query}&rdquo;</div>
          ) : (
            <>
              <div className="px-3 py-2 text-sm text-muted-foreground border-b">
                {results.length} unique card{results.length !== 1 ? "s" : ""} &mdash; {totalCopies} total cop{totalCopies !== 1 ? "ies" : "y"}
              </div>
              {results.map(card => (
                <div key={card._id} className="px-3 py-2 border-b last:border-b-0">
                  <div className="font-medium text-sm text-foreground mb-1">{card.name}</div>
                  <div className="flex flex-wrap gap-1">
                    {card.locations.map((loc, i) => (
                      <Link key={i} href={`/binder/${loc.binderId}`} onClick={() => setOpen(false)}>
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          {loc.binderName} &times; {loc.quantity}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 border-t">
                <Link
                  href={`/collection/all-cards?q=${encodeURIComponent(query)}`}
                  className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  onClick={() => setOpen(false)}
                >
                  View all results &rarr;
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

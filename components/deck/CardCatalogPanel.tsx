"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import CatalogFiltersBar from "./CatalogFiltersBar"
import CatalogCardGrid from "./CatalogCardGrid"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getApiFormatCode } from "@/lib/format-constants"

interface CardCatalogPanelProps {
  deck: any
  deckFormat?: string // Deck format (e.g., "Silver Age", "Blitz", "Classic Constructed")
  heroClasses: string[]
  heroTalents: string[]
  heroEssences?: string[]
  heroName?: string // Add hero name for heroLegal filter
  onAddCard: (cardUniqueId: string, cardName: string) => Promise<void>
  isAddingCard: boolean
}

interface CatalogFilters {
  searchQuery: string
  pitchValues: string[] // ['1', '2', '3', '0'] where '0' = no pitch
  types: string[]
  rarities: string[]
  foilings?: string[]
  costs?: number[]
  powerMin?: number
  powerMax?: number
  defenseMin?: number
  defenseMax?: number
  priceMin?: number
  priceMax?: number
  classes?: string[]
  talents?: string[]
}

export default function CardCatalogPanel({
  deck,
  deckFormat,
  heroClasses,
  heroTalents,
  heroEssences = [],
  onAddCard,
  isAddingCard
}: CardCatalogPanelProps) {
  const [filters, setFilters] = useState<CatalogFilters>({
    searchQuery: '',
    pitchValues: ['1', '2', '3', '0'], // All pitch values by default
    types: [],
    rarities: [],
    foilings: [],
    costs: []
  })
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const limit = 50

  // Serialize hero arrays to strings so useCallback doesn't re-fire on new array references
  const heroClassesKey = heroClasses.join(',')
  const heroTalentsKey = heroTalents.join(',')

  // Debounce search query to avoid excessive API calls while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(filters.searchQuery)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [filters.searchQuery])

  // Fetch cards with current filters
  const fetchCards = useCallback(async (currentPage: number) => {
    setLoading(true)
    try {
      // Build filters object for POST request
      const searchFilters: any = {}

      // Use heroClasses + heroTalents for precise subset-based legality:
      // A card is included only if card.classes ⊆ heroClasses AND card.talents ⊆ heroTalents
      // This correctly excludes e.g. light-warrior cards from a pure-warrior hero.
      if (heroClasses.length > 0 || heroTalents.length > 0) {
        searchFilters.heroClasses = heroClasses.map(c => c.toLowerCase())
        searchFilters.heroTalents = heroTalents.map(t => t.toLowerCase())
        if (heroEssences.length > 0) searchFilters.heroEssences = heroEssences.map(e => e.toLowerCase())
      }

      // Add format filter for format legality (e.g., "Classic Constructed" → "cc")
      if (deckFormat) {
        const apiFormatCode = getApiFormatCode(deckFormat);
        if (apiFormatCode) {
          searchFilters.format = apiFormatCode;
        }
      }

      // Add search query (user typing) - uses debounced value
      if (debouncedSearchQuery) {
        searchFilters.name = debouncedSearchQuery
      }

      // Add pitch value filters as colors
      if (filters.pitchValues.length > 0 && filters.pitchValues.length < 4) {
        // Only add if not all selected
        const pitchColors = filters.pitchValues
          .filter(p => p !== '0')
          .map(p => {
            if (p === '1') return 'red'
            if (p === '2') return 'yellow'
            if (p === '3') return 'blue'
            return ''
          })
          .filter(Boolean)

        if (pitchColors.length > 0) {
          searchFilters.colors = pitchColors
        }
      }

      // Add type filters
      if (filters.types.length > 0) {
        searchFilters.types = filters.types
      }

      // Add rarity filters with Silver Age restrictions
      // Silver Age format excludes: M (Majestic), L (Legendary), S (Super Rare), F (Fabled)
      const isSilverAge = deck?.format?.toLowerCase() === 'silver age'
      const excludedRarities = isSilverAge ? ['m', 'l', 's', 'f'] : []

      if (filters.rarities.length > 0) {
        // User has selected specific rarities - filter out excluded ones for Silver Age
        const allowedRarities = filters.rarities.filter(r => !excludedRarities.includes(r.toLowerCase()))
        if (allowedRarities.length > 0) {
          searchFilters.rarities = allowedRarities
        }
      } else if (excludedRarities.length > 0) {
        // No user selection but we need to exclude Silver Age rarities
        // We'll use rarityNot filter (need to add this to the API if it doesn't exist)
        // For now, we'll include all allowed rarities explicitly
        const allAllowedRarities = ['c', 'r', 'p', 't'] // Common, Rare, Promo, Token
        searchFilters.rarities = allAllowedRarities
      }

      // Add foiling filters
      if (filters.foilings && filters.foilings.length > 0) {
        searchFilters.foilings = filters.foilings
      }

      // Add cost filters
      if (filters.costs && filters.costs.length > 0) {
        searchFilters.costs = filters.costs
      }

      // Add power range filters
      if (filters.powerMin !== undefined) {
        searchFilters.powerMin = filters.powerMin
      }
      if (filters.powerMax !== undefined) {
        searchFilters.powerMax = filters.powerMax
      }

      // Add defense range filters
      if (filters.defenseMin !== undefined) {
        searchFilters.defenseMin = filters.defenseMin
      }
      if (filters.defenseMax !== undefined) {
        searchFilters.defenseMax = filters.defenseMax
      }

      // Add price filters
      if (filters.priceMin !== undefined) {
        searchFilters.priceMin = filters.priceMin
      }
      if (filters.priceMax !== undefined) {
        searchFilters.priceMax = filters.priceMax
      }

      // Build options object
      const searchOptions = {
        limit: limit,
        page: currentPage,
        sortBy: 'name',
        sortOrder: 'asc',
        show: 'unique'
      }

      console.log('[CardCatalogPanel] Fetching:', JSON.stringify(searchFilters))

      const response = await fetch('/api/printings/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: searchFilters,
          options: searchOptions
        })
      })
      const data = await response.json()

      if (data.success) {
        setCards(data.data.printings || [])
        setTotalResults(data.data.total || 0)
        setTotalPages(Math.ceil((data.data.total || 0) / limit))
      } else {
        console.error('[CardCatalogPanel] Error from API:', data.error)
        setCards([])
        setTotalResults(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('[CardCatalogPanel] Error fetching cards:', error)
      setCards([])
      setTotalResults(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroClassesKey, heroTalentsKey, heroEssences.join(','), debouncedSearchQuery, filters.pitchValues, filters.types, filters.rarities, filters.foilings, filters.costs, filters.powerMin, filters.powerMax, filters.defenseMin, filters.defenseMax, filters.priceMin, filters.priceMax, limit])

  // Fetch cards when filters or page changes
  useEffect(() => {
    fetchCards(page)
  }, [page, fetchCards])

  // Reset to page 1 when filters change (excluding live searchQuery)
  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    } else {
      fetchCards(1)
    }
  }, [debouncedSearchQuery, filters.pitchValues, filters.types, filters.rarities, filters.foilings, filters.costs, filters.powerMin, filters.powerMax, filters.defenseMin, filters.defenseMax, filters.priceMin, filters.priceMax])

  const handleFilterChange = (newFilters: Partial<CatalogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  // Client-side filtering for classes and talents
  // API returns card.classes as lowercase array (e.g. ['brute'])
  // UI filter values are capitalized (e.g. 'Brute') so we compare lowercase
  const filteredCards = useMemo(() => {
    let result = cards

    // Filter by class: card.classes is an array like ['brute'], filter values are like 'Brute'
    if (filters.classes && filters.classes.length > 0) {
      const selectedClassesLower = filters.classes.map(c => c.toLowerCase())
      result = result.filter(card => {
        const cardClasses: string[] = card.classes || []
        // Generic cards pass through when class filter is active
        if (cardClasses.length === 0 || card.is_generic) return true
        return cardClasses.some(c => selectedClassesLower.includes(c.toLowerCase()))
      })
    }

    // Filter by talent: card.talents is an array like ['shadow'], filter values are like 'Shadow'
    if (filters.talents && filters.talents.length > 0) {
      const selectedTalentsLower = filters.talents.map(t => t.toLowerCase())
      result = result.filter(card => {
        const cardTalents: string[] = card.talents || []
        return cardTalents.some(t => selectedTalentsLower.includes(t.toLowerCase()))
      })
    }

    return result
  }, [cards, filters.classes, filters.talents])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Card Catalog</h2>
            <p className="text-xs text-muted-foreground">
              {totalResults} cards • {deck.format}
              {deck?.format?.toLowerCase() === 'silver age' && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  (Rarity restrictions: C, R, P, T only)
                </span>
              )}
              <span className="ml-2 italic">· click to add</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <CatalogFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        deckFormat={deck?.format}
      />

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <CatalogCardGrid
          cards={filteredCards}
          loading={loading}
          onAddCard={onAddCard}
          isAddingCard={isAddingCard}
        />
      </div>

      {/* Pagination */}
      <div className="border-t p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

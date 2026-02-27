// lib/browse/hooks/useBrowseSearch.ts
import { useState, useRef, useEffect } from 'react'

export function useBrowseSearch() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filterSet, setFilterSet] = useState("")
  const [filterRarity, setFilterRarity] = useState("")
  const [filterType, setFilterType] = useState("")
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCards, setTotalCards] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const initialRender = useRef(true)

  // Debounce logic
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
      }
    }
  }, [searchQuery])

  const fetchCards = async (newPage = 1) => {
    // Your existing fetchCards logic
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCards(1)
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setDebouncedQuery("")
    setFilterSet("")
    setFilterRarity("")
    setFilterType("")
    setHasSearched(false)
    setCards([])
  }

  return {
    // State
    searchQuery,
    debouncedQuery,
    filterSet,
    filterRarity,
    filterType,
    cards,
    loading,
    error,
    page,
    totalPages,
    totalCards,
    hasSearched,
    
    // Actions
    setSearchQuery,
    setFilterSet,
    setFilterRarity,
    setFilterType,
    fetchCards,
    handleSearch,
    handleClearFilters,
    setError
  }
}
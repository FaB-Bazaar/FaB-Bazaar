import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"
import { debounce } from "@/lib/utils"

interface CardFilterBarProps {
  searchQuery?: string
  setSearchQuery?: (v: string) => void
  filterRarity?: string
  setFilterRarity?: (v: string) => void
  rarities?: { code: string; name: string }[]
  filterFoiling?: string
  setFilterFoiling?: (v: string) => void
  foilings?: { code: string; name: string }[]
  filterSet?: string
  setFilterSet?: (v: string) => void
  sets?: { code: string; name: string }[]
  filterPriority?: string
  setFilterPriority?: (v: string) => void
  priorities?: { code: string; name: string }[]
  sortOption?: string
  setSortOption?: (v: string) => void
  sortOptions?: { code: string; name: string }[]
  className?: string
}

const CardFilterBar: React.FC<CardFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  filterRarity,
  setFilterRarity,
  rarities,
  filterFoiling,
  setFilterFoiling,
  foilings,
  filterSet,
  setFilterSet,
  sets,
  filterPriority,
  setFilterPriority,
  priorities,
  sortOption,
  setSortOption,
  sortOptions,
  className = "",
}) => {
  // Local state for the search input value
  const [searchInputValue, setSearchInputValue] = useState(searchQuery || "")

  // Update local state when searchQuery prop changes
  useEffect(() => {
    setSearchInputValue(searchQuery || "")
  }, [searchQuery])

  // Debounced function to update the actual search query
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      if (setSearchQuery) {
        setSearchQuery(value)
      }
    }, 300), // 300ms debounce
    [setSearchQuery]
  )

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchInputValue(value)
    debouncedSetSearchQuery(value)
  }

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInputValue("")
    if (setSearchQuery) {
      setSearchQuery("")
    }
  }

  return (
    <div className={`flex flex-wrap gap-4 mb-4 ${className}`}>
      {setSearchQuery && (
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search cards..."
            className="pl-8 pr-10"
            value={searchInputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchInputValue && (
            <button
              type="button"
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Enhanced Filter Organization */}
      <div className="flex flex-wrap gap-4">
        {setFilterRarity && rarities && (
          <div className="flex flex-col">
            <Select value={filterRarity} onValueChange={setFilterRarity}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                {/* Custom order for rarities */}
                {[
                  { code: "M", name: "Majestic" },
                  { code: "L", name: "Legendary" },
                  { code: "F", name: "Fabled" },
                  { code: "V", name: "Marvel" },
                  { code: "E", name: "Extended Art" },
                  { code: "P", name: "Promo" },
                  { code: "R", name: "Rare" },
                  { code: "S", name: "Super Rare" },
                  { code: "C", name: "Common" },
                  { code: "B", name: "Basic" },
                  { code: "T", name: "Token" },
                ].map((r) => (
                  <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 mt-1">
              {filterRarity !== "all" && (
                <button
                  className="text-xs text-blue-600 underline"
                  type="button"
                  onClick={() => setFilterRarity("all")}
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        {setFilterFoiling && foilings && (
          <div className="flex flex-col">
            <Select value={filterFoiling} onValueChange={setFilterFoiling}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Foiling" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Foilings</SelectItem>
                {foilings.map((f) => (
                  <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 mt-1">
              {filterFoiling !== "all" && (
                <button
                  className="text-xs text-blue-600 underline"
                  type="button"
                  onClick={() => setFilterFoiling("all")}
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        {setFilterSet && sets && (
          <div className="flex flex-col">
            <Select value={filterSet} onValueChange={setFilterSet}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sets</SelectItem>
                {sets.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 mt-1">
              {filterSet !== "all" && (
                <button
                  className="text-xs text-blue-600 underline"
                  type="button"
                  onClick={() => setFilterSet("all")}
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        {setFilterPriority && priorities && (
          <div className="flex flex-col">
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorities.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 mt-1">
              {filterPriority !== "all" && (
                <button
                  className="text-xs text-blue-600 underline"
                  type="button"
                  onClick={() => setFilterPriority("all")}
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        {setSortOption && sortOptions && (
          <div className="flex flex-col">
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

export default CardFilterBar

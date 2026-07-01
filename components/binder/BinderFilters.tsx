//components/binder/BinderFilters.tsx

"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import CardFilterBar from "@/components/binder/BinderCardFilterBar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Types
interface BinderFiltersProps {
  binder: any
  metadata: any
  editable: boolean
  loading: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  filterForTrade: string
  setFilterForTrade: (filter: string) => void
  filterRarity: string
  setFilterRarity: (filter: string) => void
  filterFoiling: string
  setFilterFoiling: (filter: string) => void
  filterSet: string
  setFilterSet: (filter: string) => void
  sortOption: string
  setSortOption: (option: string) => void
  stats: {
    totalCards: number
    forTradeCount: number
    uniqueCards: number
    estimatedValue: number
  }
  onSetAllForTrade: (forTradeValue: boolean) => void
}

export default function BinderFilters({
  binder,
  metadata,
  editable,
  loading,
  searchQuery,
  setSearchQuery,
  filterForTrade,
  setFilterForTrade,
  filterRarity,
  setFilterRarity,
  filterFoiling,
  setFilterFoiling,
  filterSet,
  setFilterSet,
  sortOption,
  setSortOption,
  stats,
  onSetAllForTrade
}: BinderFiltersProps) {

  // Helper function to get foiling display name
  const getFoilingDisplayName = (code?: string) => {
    if (!code) return ""
    if (code === "S") return "Non-Foil"
    if (metadata && metadata.foilings) {
      const foiling = metadata.foilings.find((f: any) => f.code === code)
      return foiling ? foiling.name : code
    }
    const foilingMap: Record<string, string> = {
      S: "Non-Foil",
      R: "Rainbow Foil",
      C: "Cold Foil",
      G: "Gold Foil",
    }
    return foilingMap[code] || code
  }


  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("")
    setFilterRarity("all")
    setFilterFoiling("all")
    setFilterSet("all")
    setFilterForTrade("all")
  }

  // Check if any filters are active
  const hasActiveFilters = searchQuery || 
    filterRarity !== "all" || 
    filterFoiling !== "all" || 
    filterSet !== "all" || 
    filterForTrade !== "all"

  return (
    <div className="mb-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600 p-4 space-y-4">
        {/* Search and Primary Filters */}
        <CardFilterBar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          filterRarity={filterRarity} 
          setFilterRarity={setFilterRarity} 
          rarities={metadata?.rarities} 
          filterFoiling={filterFoiling} 
          setFilterFoiling={setFilterFoiling} 
          foilings={metadata?.foilings?.filter((f: any) => ["S", "R", "C", "G"].includes(f.code))?.sort((a: { code: string }, b: { code: string }) => { 
            const order: Record<string, number> = { S: 0, R: 1, C: 2, G: 3 }
            return order[a.code] - order[b.code]
          })} 
          filterSet={filterSet} 
          setFilterSet={setFilterSet} 
          sets={metadata?.sets} 
          sortOption={sortOption} 
          setSortOption={setSortOption} 
          sortOptions={[
            { code: "name-asc", name: "Name (A to Z)" }, 
            { code: "name-desc", name: "Name (Z to A)" }
          ]} 
        />

        {/* Trade Status Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-64">
            <Select value={filterForTrade} onValueChange={setFilterForTrade}>
              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectItem value="all" className="text-gray-900 dark:text-gray-100">
                  All Cards ({binder?.cards.length || 0})
                </SelectItem>
                <SelectItem value="forTrade" className="text-gray-900 dark:text-gray-100">
                  For Trade ({stats.forTradeCount})
                </SelectItem>
                <SelectItem value="notForTrade" className="text-gray-900 dark:text-gray-100">
                  Not For Trade ({(binder?.cards.length || 0) - stats.forTradeCount})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions - Desktop Only */}
{editable && (
  <div className="hidden sm:flex gap-2 items-center">
    {/* "All For Trade" Dialog */}
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={loading} className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600">
          All For Trade
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will mark all cards in this binder as 'For Trade'.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onSetAllForTrade(true)}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* "All Not For Trade" Dialog */}
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={loading} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          All Not For Trade
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will mark all cards in this binder as 'Not For Trade'.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onSetAllForTrade(false)}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {binder.forTradeAll !== undefined && (
      <span className="text-xs text-blue-700 dark:text-blue-400 font-semibold">
        Binder: {binder.forTradeAll ? "All For Trade" : "Not For Trade"}
      </span>
    )}
  </div>
)}

{/* Mobile Bulk Actions */}
{editable && (
  <div className="sm:hidden flex flex-col gap-2">
    <div className="flex gap-2">
      {/* "All For Trade" Dialog for Mobile */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="secondary" disabled={loading} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600">
            All For Trade
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark all cards in this binder as 'For Trade'.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onSetAllForTrade(true)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* "All Not For Trade" Dialog for Mobile */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading} className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            All Not For Trade
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark all cards in this binder as 'Not For Trade'.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onSetAllForTrade(false)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    {binder.forTradeAll !== undefined && (
      <div className="text-center">
        <span className="text-xs text-blue-700 dark:text-blue-400 font-semibold">
          Binder: {binder.forTradeAll ? "All For Trade" : "Not For Trade"}
        </span>
      </div>
    )}
  </div>
)}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            
            {searchQuery && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white">
                "{searchQuery}"
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filterRarity !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white">
                {filterRarity}
                <button 
                  onClick={() => setFilterRarity("all")} 
                  className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Clear rarity filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filterFoiling !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white">
                {getFoilingDisplayName(filterFoiling)}
                <button 
                  onClick={() => setFilterFoiling("all")} 
                  className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Clear foiling filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filterSet !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white">
                {filterSet}
                <button 
                  onClick={() => setFilterSet("all")} 
                  className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Clear set filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filterForTrade !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white">
                {filterForTrade === "forTrade" ? "For Trade" : "Not For Trade"}
                <button 
                  onClick={() => setFilterForTrade("all")} 
                  className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Clear trade status filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            <button
              onClick={clearAllFilters}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
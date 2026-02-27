//components/binder/BinderResultsBar.tsx

"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart, CheckSquare, Copy, Check, ArrowRight } from "lucide-react"

// Types
interface BinderResultsBarProps {
  sortedCards: any[]
  binder: any
  selectedCards: any[]
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  copied: boolean
  editable: boolean
  user: any
  onSelectForTrade: () => void
  onSelectAll: () => void
  onCopyAll: () => void
  onCopySelected: () => void
  onTransfer: () => void
}

export default function BinderResultsBar({
  sortedCards,
  binder,
  selectedCards,
  sidebarOpen,
  setSidebarOpen,
  copied,
  editable,
  user,
  onSelectForTrade,
  onSelectAll,
  onCopyAll,
  onCopySelected,
  onTransfer
}: BinderResultsBarProps) {

  return (
    <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        
        {/* Results Count and Quick Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Showing {sortedCards.length} of {binder?.cards?.length || 0} cards
          </span>
          
          {sortedCards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelectForTrade()
                  setSidebarOpen(true)
                }}
                disabled={!sortedCards.some((card: any) => card.forTrade)}
                className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Select For Trade
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelectAll()
                  setSidebarOpen(true)
                }}
                className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
            </div>
          )}
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap gap-2">
          <div className={`flex gap-2 ${sidebarOpen ? 'mr-80' : ''}`}>
            
            {/* Copy All Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onCopyAll} 
              className={copied ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-300 dark:border-green-600" : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All
                </>
              )}
            </Button>
            
            {/* Copy Selected Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onCopySelected} 
              disabled={!selectedCards.length}
              className={copied && selectedCards.length ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-300 dark:border-green-600" : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}
            >
              {copied && selectedCards.length ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Selected ({selectedCards.length})
                </>
              )}
            </Button>
          </div>

          {/* Transfer Button - Only for editable binders with selected cards */}
          {user && editable && selectedCards.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTransfer} 
              className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Transfer ({selectedCards.length})
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
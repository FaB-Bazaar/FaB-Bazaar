// components/collection/QuickBinderGrid.tsx
"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Trash2, Package, Coins, TrendingUp, Eye, EyeOff } from "lucide-react"
import { BinderWithStats } from "@/app/collection/page"

interface QuickBinderGridProps {
  binders: BinderWithStats[]
  onDeleteBinder: (binder: BinderWithStats) => void
}

export function QuickBinderGrid({ binders, onDeleteBinder }: QuickBinderGridProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const getVisibilityInfo = (binder: BinderWithStats) => {
    const isPublic = binder.isPublic || binder.visibility?.level === 'public'

    if (isPublic) {
      return { icon: Eye, label: 'Public', color: 'text-blue-600' }
    } else {
      return { icon: EyeOff, label: 'Private', color: 'text-gray-500' }
    }
  }

  if (binders.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No binders yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first binder to get started</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Your Binders ({binders.length})
        </h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Click any binder to open it
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {binders.map((binder) => {
          const visibility = getVisibilityInfo(binder)
          const VisibilityIcon = visibility.icon
          const totalCards = binder.totalQuantity || 0
          const totalValue = binder.totalValue?.tcg_low || binder.total_value || 0
          const forTradeCards = binder.quantityForTrade || 0
          
          return (
            <Card 
              key={binder._id} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Link 
                    href={`/binder/${binder._id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {binder.name}
                    </h3>
                    {binder.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {binder.description}
                      </p>
                    )}
                  </Link>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <div className={`flex items-center gap-1 ${visibility.color}`}>
                      <VisibilityIcon className="h-3 w-3" />
                      <span className="text-xs">{visibility.label}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-sm">{totalCards.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">cards</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="font-medium text-sm text-green-600">
                        {formatCurrency(totalValue)}
                      </div>
                      <div className="text-xs text-gray-500">value</div>
                    </div>
                  </div>
                </div>

                {/* For Trade Info */}
                {forTradeCards > 0 && (
                  <div className="flex items-center gap-1 mb-3 text-xs text-orange-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>{forTradeCards} for trade</span>
                  </div>
                )}

                {/* Tags */}
                {binder.tags && binder.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {binder.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs px-2 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {binder.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-2 py-0">
                        +{binder.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <Link href={`/binder/${binder._id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      Open Binder
                    </Button>
                  </Link>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault()
                      onDeleteBinder(binder)
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
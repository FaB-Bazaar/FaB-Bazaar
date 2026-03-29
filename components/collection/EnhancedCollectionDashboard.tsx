// components/collection/EnhancedCollectionDashboard.tsx
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  BookOpen, Package, Coins, TrendingUp, Shield, 
  Trophy, Star, PieChart, BarChart3
} from "lucide-react"
import { BinderWithStats, CollectionOverview } from "@/app/collection/page" // Adjusted import path

interface EnhancedCollectionDashboardProps {
  binders: BinderWithStats[]
  overview: CollectionOverview | null
  onDeleteBinder: (binder: BinderWithStats) => void
}

const RARITY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    'F': { label: 'Fabled', icon: '🌟', color: 'text-amber-500' },
    'L': { label: 'Legendary', icon: '👑', color: 'text-yellow-500' },
    'M': { label: 'Majestic', icon: '🔥', color: 'text-red-500' },
    'S': { label: 'Super Rare', icon: '💎', color: 'text-purple-500' },
    'R': { label: 'Rare', icon: '💠', color: 'text-blue-500' },
    'C': { label: 'Common', icon: '⚪', color: 'text-slate-500' },
    'T': { label: 'Token', icon: '🪙', color: 'text-green-500' },
    'P': { label: 'Promo', icon: '🎁', color: 'text-pink-500' },
    'V': { label: 'Marvel', icon: '✨', color: 'text-indigo-500' }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
};

const formatCompact = (value: number) => {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
    return value.toString();
};


export function CollectionHighlights({ overview }: { overview: CollectionOverview }) {
  const { collection } = overview;
  
    const getTopRarities = () => {
    const desiredOrder = ["F", "L", "M", "P"]; // Fabled, Legendary, Majestic, Promo

    return desiredOrder
        .map((rarity) => [rarity, collection.rarityCounts[rarity] || 0] as [string, number])
        .filter(([, count]) => count > 0);
    };

  const forTradePercentage = collection.totalQuantity > 0
    ? (collection.quantityForTrade / collection.totalQuantity) * 100
    : 0;

  // Stat Card Component for reusability
  const StatCard = ({ title, value, icon, progress, progressText }: { title: string; value: string; icon: React.ReactNode; progress?: number; progressText?: string; }) => (
    <Card className="bg-card/50">
        <CardContent className="p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    {progress !== undefined && progressText && (
                        <div className="flex items-center mt-1">
                            <Progress value={progress} className="w-12 h-2 mr-2" />
                            <span className="text-xs text-muted-foreground">{progressText}</span>
                        </div>
                    )}
                </div>
                {icon}
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Cards" value={formatCompact(collection.totalQuantity)} icon={<Package className="h-8 w-8 text-muted-foreground/50" />} />
        <StatCard title="Collection Value" value={formatCurrency(collection.totalValues.tcg_low)} icon={<Coins className="h-8 w-8 text-muted-foreground/50" />} />
        <StatCard
          title="For Trade"
          value={formatCompact(collection.quantityForTrade)}
          icon={<TrendingUp className="h-8 w-8 text-muted-foreground/50" />}
          progress={forTradePercentage}
          progressText={`${Math.round(forTradePercentage)}%`}
        />
      </div>

      {/* Rarity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5" />
            Rarity Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {getTopRarities().map(([rarity, count]) => {
              const config = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
              const percentage = (count / collection.totalQuantity) * 100;
              const forTradeCount = collection.rarityCountsForTrade[rarity] || 0;
              
              return (
                <div key={rarity} className="bg-background/50 rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl ${config?.color}`}>{config?.icon || '⭐'}</span>
                    <Badge variant="secondary" className="text-xs">{config?.label || rarity}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-lg text-foreground">{count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of collection</div>
                    {forTradeCount > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {forTradeCount} for trade
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Value Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-5 w-5" />
              Trading Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                For Trade
              </span>
              <div className="text-right">
                <div className="font-semibold text-foreground">{collection.quantityForTrade.toLocaleString()} cards</div>
                <div className="text-sm text-green-600 dark:text-green-500">{formatCurrency(collection.valueForTrade.tcg_low)}</div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 text-blue-500" />
                Personal Collection
              </span>
              <div className="text-right">
                <div className="font-semibold text-foreground">{collection.quantityNotForTrade.toLocaleString()} cards</div>
                <div className="text-sm text-green-600 dark:text-green-500">{formatCurrency(collection.valueNotForTrade.tcg_low)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Price Range
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">TCG Low</span>
              <span className="font-bold text-green-600 dark:text-green-500">{formatCurrency(collection.totalValues.tcg_low)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">TCG High</span>
              <span className="font-medium text-foreground">{formatCurrency(collection.totalValues.tcg_high)}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-1">Value Range</div>
              <div className="text-sm font-medium text-foreground">
                {formatCurrency(collection.totalValues.tcg_high - collection.totalValues.tcg_low)} spread
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public vs Private */}
    </div>
  );
}

function BinderQuickAccess({ binders, onDeleteBinder }: { binders: BinderWithStats[], onDeleteBinder: (binder: BinderWithStats) => void }) {
  const formatBinderCurrency = (value: number) => {
    if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {binders.map((binder) => {
        const totalCards = binder.totalQuantity || 0;
        const totalValue = binder.totalValue?.tcg_low || binder.total_value || 0;
        const forTradeCards = binder.quantityForTrade || 0;
        
        return (
          <Card key={binder._id} className="hover:border-primary transition-colors duration-200 flex flex-col">
            <CardContent className="p-4 flex flex-col flex-grow">
              <div className="flex-grow space-y-3">
                <div className="flex items-start justify-between">
                  <Link href={`/binder/${binder._id}`} className="flex-1 min-w-0 group">
                    <h3 className="font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                      {binder.name}
                    </h3>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {binder.slug || binder.discordExternalId}
                      </Badge>
                    </div>
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Cards</div>
                    <div className="font-semibold text-foreground">{totalCards.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="font-semibold text-green-600 dark:text-green-500">{formatBinderCurrency(totalValue)}</div>
                  </div>
                </div>

                {forTradeCards > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-500">
                    <span className="font-semibold">{forTradeCards}</span> cards for trade
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/binder/${binder._id}`}>Open</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent link navigation
                    onDeleteBinder(binder);
                  }}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function EnhancedCollectionDashboard({ binders, overview, onDeleteBinder }: EnhancedCollectionDashboardProps) {
  if (binders.length === 0 && !overview) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-16 w-16 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No binders yet</h3>
        <p>Create your first binder in the "Manage" tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {overview && <CollectionHighlights overview={overview} />}
      
      {binders.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Binder Access ({binders.length})</h2>
          <BinderQuickAccess binders={binders} onDeleteBinder={onDeleteBinder} />
        </div>
      )}
    </div>
  );
}
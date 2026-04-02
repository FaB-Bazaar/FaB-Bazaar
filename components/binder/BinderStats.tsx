"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Eye, Settings, Globe, Lock, EyeOff, TrendingUp, Package, Coins, Star, PieChart, RefreshCw, Loader2 } from "lucide-react"
import { RarityIcon } from "@/components/shared/RarityIcon"
import { formatDistanceToNow } from "date-fns"

// --- TYPES ---
interface BinderWithStats {
  _id: string;
  name: string;
  isPublic?: boolean;
  visibility?: {
    level: 'public' | 'private' | 'unlisted';
    [key: string]: any;
  };
  totalQuantity?: number;
  quantityForTrade?: number;
  quantityNotForTrade?: number;
  totalValue?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts?: Record<string, number>;
  rarityCountsForTrade?: Record<string, number>;
  rarityCountsNotForTrade?: Record<string, number>;
  // Legacy fields for backwards compatibility
  total_value?: number;
  total_cards_with_pricing?: number;
  total_cards_without_pricing?: number;
}

interface BinderStatsProps {
  binder: BinderWithStats
  stats: any // Keep for backwards compatibility
  loading: boolean
  editable: boolean
  onOpenSettings?: () => void
}

// --- RARITY CONFIGURATION ---
const RARITY_CONFIG = {
  'C': { label: 'Common', color: 'bg-gray-500', priority: 1 },
  'R': { label: 'Rare', color: 'bg-blue-500', priority: 2 },
  'S': { label: 'Super Rare', color: 'bg-purple-500', priority: 3 },
  'M': { label: 'Majestic', color: 'bg-red-500', priority: 4 },
  'L': { label: 'Legendary', color: 'bg-yellow-500', priority: 5 },
  'F': { label: 'Fabled', color: 'bg-orange-500', priority: 6 },
  'T': { label: 'Token', color: 'bg-green-500', priority: 0 },
  'V': { label: 'Promo', color: 'bg-pink-500', priority: 7 },
  'P': { label: 'Special', color: 'bg-indigo-500', priority: 8 },
  // Lowercase variants (from your data)
  'c': { label: 'Common', color: 'bg-gray-500', priority: 1 },
  'r': { label: 'Rare', color: 'bg-blue-500', priority: 2 },
  's': { label: 'Super Rare', color: 'bg-purple-500', priority: 3 },
  'm': { label: 'Majestic', color: 'bg-red-500', priority: 4 },
  'l': { label: 'Legendary', color: 'bg-yellow-500', priority: 5 },
  'f': { label: 'Fabled', color: 'bg-orange-500', priority: 6 },
  't': { label: 'Token', color: 'bg-green-500', priority: 0 },
  'v': { label: 'Promo', color: 'bg-pink-500', priority: 7 },
  'p': { label: 'Special', color: 'bg-indigo-500', priority: 8 },
};

// --- HELPER FUNCTIONS ---
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getVisibilityIcon(binder: BinderWithStats) {
  if (binder.visibility?.level === 'public' || binder.isPublic) {
    return <Globe className="h-4 w-4" />;
  } else if (binder.visibility?.level === 'unlisted') {
    return <EyeOff className="h-4 w-4" />;
  } else {
    return <Lock className="h-4 w-4" />;
  }
}

function getVisibilityLabel(binder: BinderWithStats): string {
  if (binder.visibility?.level === 'public' || binder.isPublic) {
    return 'Public';
  } else if (binder.visibility?.level === 'unlisted') {
    return 'Unlisted';
  } else {
    return 'Private';
  }
}

function sortRarities(rarities: string[]): string[] {
  return rarities.sort((a, b) => {
    const priorityA = RARITY_CONFIG[a]?.priority ?? 99;
    const priorityB = RARITY_CONFIG[b]?.priority ?? 99;
    return priorityB - priorityA; // Descending order (highest priority first)
  });
}

function SimplePieChart({ 
  data, 
  size = 120 
}: { 
  data: Array<{ label: string; value: number; color: string }>; 
  size?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div className="text-sm text-muted-foreground">No data</div>;

  const radius = 45;
  const center = size / 2;
  let cumulativeAngle = 0;

  const paths = data.map((segment, index) => {
    const percentage = segment.value / total;
    const angle = percentage * 2 * Math.PI;
    
    const startX = center + radius * Math.cos(cumulativeAngle);
    const startY = center + radius * Math.sin(cumulativeAngle);
    
    const endX = center + radius * Math.cos(cumulativeAngle + angle);
    const endY = center + radius * Math.sin(cumulativeAngle + angle);
    
    const largeArcFlag = angle > Math.PI ? 1 : 0;
    
    const pathData = [
      `M ${center} ${center}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      'Z'
    ].join(' ');
    
    cumulativeAngle += angle;
    
    return (
      <path
        key={index}
        d={pathData}
        fill={segment.color}
        stroke="white"
        strokeWidth="2"
      />
    );
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
      </svg>
      <div className="space-y-2">
        {data.map((segment, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="font-medium">{segment.label}</span>
            <span className="font-mono text-muted-foreground">
              {typeof segment.value === 'number' && segment.value < 1 
                ? `$${segment.value.toFixed(2)}` 
                : segment.value.toLocaleString()
              } ({((segment.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RarityBreakdown({ 
  title, 
  rarityCounts, 
  totalCards, 
  showPercentages = false 
}: { 
  title: string; 
  rarityCounts: Record<string, number>; 
  totalCards: number;
  showPercentages?: boolean;
}) {
  const sortedRarities = sortRarities(Object.keys(rarityCounts).filter(r => rarityCounts[r] > 0));
  
  if (sortedRarities.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <div className="text-sm text-muted-foreground">No cards</div>
      </div>
    );
  }

  const rarityLabels: Record<string, string> = {
    'F': 'Fabled',
    'L': 'Legendary', 
    'M': 'Majestic',
    'S': 'Super Rare',
    'R': 'Rare',
    'C': 'Common',
    'T': 'Token',
    'P': 'Promo',
    'V': 'Marvel',
    // Lowercase variants
    'f': 'Fabled',
    'l': 'Legendary', 
    'm': 'Majestic',
    's': 'Super Rare',
    'r': 'Rare',
    'c': 'Common',
    't': 'Token',
    'p': 'Promo',
    'v': 'Marvel',
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground text-center">{title}</h4>
      <div className="flex flex-wrap gap-2 justify-center">
        {sortedRarities.map((rarity) => {
          const count = rarityCounts[rarity];
          const percentage = totalCards > 0 ? (count / totalCards) * 100 : 0;
          const label = rarityLabels[rarity] || rarity.toUpperCase();
          
          return (
            <div 
              key={rarity} 
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted text-sm font-medium"
            >
              <RarityIcon 
                rarityCode={rarity.toUpperCase()} 
                size="sm" 
              />
              <span>{label}</span>
              <span className="font-mono text-muted-foreground">
                {count}
                {showPercentages && (
                  <span className="ml-1">
                    ({percentage.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function BinderStats({ binder, stats, loading, editable, onOpenSettings }: BinderStatsProps) {

  // Extract data from the full binder object
  const rarityCounts = binder?.rarityCounts || {};
  
  // Calculate totals (with fallbacks to legacy fields)
  const totalCards = binder?.totalQuantity || 
                     stats?.totalCards || 
                     (binder?.total_cards_with_pricing || 0) + (binder?.total_cards_without_pricing || 0);
  
  const cardsForTrade = binder?.quantityForTrade || stats?.forTradeCount || 0;
  const cardsNotForTrade = binder?.quantityNotForTrade || (totalCards - cardsForTrade);
  
  // Calculate values
  const totalValue = binder?.totalValue?.tcg_low || binder?.total_value || stats?.estimatedValue || 0;
  const valueForTrade = binder?.valueForTrade?.tcg_low || 0;
  const valueNotForTrade = binder?.valueNotForTrade?.tcg_low || 0;
  
  // Calculate percentages
  const forTradePercentage = totalCards > 0 ? (cardsForTrade / totalCards) * 100 : 0;
  const valueForTradePercentage = totalValue > 0 ? (valueForTrade / totalValue) * 100 : 0;

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCards.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(rarityCounts).length} different rarities
            </p>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              TCG Low price estimate
            </p>
          </CardContent>
        </Card>

        {/* For Trade */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">For Trade</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cardsForTrade.toLocaleString()}</div>
            <div className="flex items-center gap-2">
              <Progress value={forTradePercentage} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground w-12">
                {forTradePercentage.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Visibility */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visibility</CardTitle>
            {getVisibilityIcon(binder)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getVisibilityLabel(binder)}</div>
            {editable && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={onOpenSettings}
              >
                Change settings
              </Button>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Value and Card Distribution with Pie Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Value Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart 
              data={[
                { 
                  label: 'For Trade', 
                  value: valueForTrade, 
                  color: '#3b82f6' // blue-500
                },
                { 
                  label: 'Not for Trade', 
                  value: valueNotForTrade, 
                  color: '#6b7280' // gray-500
                }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Card Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart 
              data={[
                { 
                  label: 'For Trade', 
                  value: cardsForTrade, 
                  color: '#3b82f6' // blue-500
                },
                { 
                  label: 'Not for Trade', 
                  value: cardsNotForTrade, 
                  color: '#6b7280' // gray-500
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Rarity Breakdown - Using RarityIcon grid layout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5" />
            Rarity Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(rarityCounts).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No rarity data available
            </div>
          ) : (
            <RarityBreakdown 
              title="All Cards"
              rarityCounts={rarityCounts}
              totalCards={totalCards}
              showPercentages={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Additional Value Details (if available) */}
      {binder?.totalValue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Price Estimates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-bold">{formatCurrency(binder.totalValue.tcg_low || 0)}</div>
                <div className="text-xs text-muted-foreground">TCG Low</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatCurrency(binder.totalValue.tcg_market || 0)}</div>
                <div className="text-xs text-muted-foreground">TCG Market</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatCurrency(binder.totalValue.tcg_mid || 0)}</div>
                <div className="text-xs text-muted-foreground">TCG Mid</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatCurrency(binder.totalValue.tcg_high || 0)}</div>
                <div className="text-xs text-muted-foreground">TCG High</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
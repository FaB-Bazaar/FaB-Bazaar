// components/deck/DeckStats.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Globe, 
  Lock,
  Layers,
  DollarSign,
  Users,
  Clock,
  Target,
  Shield,
  Sword,
  BookOpen,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeckStatsProps {
  stats: {
    totalDecks: number;
    publicDecks: number;
    totalCards: number;
    totalUniqueCards: number;
    totalEstimatedValue: number;
    formatBreakdown: Array<{
      format: string;
      count: number;
      totalValue: number;
      totalCards: number;
    }>;
    categoryBreakdown: {
      heroes: number;
      equipment: number;
      maindeck: number;
      inventory: number;
      maybeboard: number;
      tokens: number;
    };
    recentActivity: Array<{
      _id: string;
      name: string;
      updatedAt: string;
      format: string;
    }>;
  };
  onViewFormat?: (format: string) => void;
}

export default function DeckStats({ stats, onViewFormat }: DeckStatsProps) {
  const getFormatColor = (format: string) => {
    const colors = {
      'Classic Constructed': 'bg-blue-500',
      'Silver Age': 'bg-cyan-500',
      'Blitz': 'bg-red-500',
      'Limited': 'bg-green-500',
      'Commoner': 'bg-yellow-500',
      'Living Legend': 'bg-purple-500'
    };
    return colors[format as keyof typeof colors] || 'bg-gray-500';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      heroes: Users,
      equipment: Shield,
      maindeck: Sword,
      inventory: Package,
      maybeboard: BookOpen,
      tokens: Target
    };
    return icons[category as keyof typeof icons] || Package;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      heroes: 'text-purple-600 dark:text-purple-400',
      equipment: 'text-blue-600 dark:text-blue-400',
      maindeck: 'text-green-600 dark:text-green-400',
      inventory: 'text-orange-600 dark:text-orange-400',
      maybeboard: 'text-gray-600 dark:text-gray-400',
      tokens: 'text-yellow-600 dark:text-yellow-400'
    };
    return colors[category as keyof typeof colors] || 'text-gray-600 dark:text-gray-400';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const privateDecks = stats.totalDecks - stats.publicDecks;
  const avgDeckValue = stats.totalDecks > 0 ? stats.totalEstimatedValue / stats.totalDecks : 0;
  const avgCardsPerDeck = stats.totalDecks > 0 ? stats.totalCards / stats.totalDecks : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Decks</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDecks}</div>
            <p className="text-xs text-muted-foreground">
              All your decklists
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCards}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUniqueCards} unique cards
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Public Decks</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.publicDecks}</div>
            <p className="text-xs text-muted-foreground">
              {privateDecks} private
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.totalEstimatedValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${avgDeckValue.toFixed(0)} avg per deck
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Format Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.formatBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No decks created yet
              </div>
            ) : (
              <div className="space-y-4">
                {stats.formatBreakdown.map(({ format, count, totalValue, totalCards }) => {
                  const percentage = stats.totalDecks > 0 ? (count / stats.totalDecks) * 100 : 0;
                  
                  return (
                    <div key={format} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded-full", getFormatColor(format))} />
                          <span className="font-medium">{format}</span>
                          {onViewFormat && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewFormat(format)}
                              className="text-xs h-6 px-2"
                            >
                              View
                            </Button>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                          <div>{count} deck{count !== 1 ? 's' : ''} ({percentage.toFixed(0)}%)</div>
                          <div className="text-xs">
                            {totalCards} cards • ${totalValue.toFixed(0)}
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full transition-all", getFormatColor(format))}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Card Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.categoryBreakdown).map(([category, count]) => {
                if (count === 0) return null;
                
                const Icon = getCategoryIcon(category);
                const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                
                return (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", getCategoryColor(category))} />
                      <span className="font-medium capitalize">
                        {category === 'maindeck' ? 'Main Deck' : category}
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{count}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalDecks > 0 ? ((stats.publicDecks / stats.totalDecks) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Public</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {avgCardsPerDeck.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Cards</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((deck) => (
                  <div key={deck._id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{deck.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {deck.format}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(deck.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
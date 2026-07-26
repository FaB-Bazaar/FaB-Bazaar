// components/deck/DeckAnalysis.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Target,
  Zap,
  Shield,
  Layers,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

// Updated interface to match new data model
interface DeckAnalysisProps {
  deck: {
    _id: string;
    name: string;
    format: string;
    // New structure - arrays by category
    hero: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
    equipment: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
    maindeck: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
    inventory: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
    maybeboard?: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
    tokens?: Array<{
      printingId: string;
      condition?: string;
      notes?: string;
      addedAt: string;
      printingDetails?: {
        display_name?: string;
        name?: string;
        color?: string;
        type_text?: string;
        cost?: number;
        pitch?: number;
        tcg_market?: number;
        tcg_low?: number;
        rarity?: string;
      };
    }>;
  };
  stats: {
    totalCards: number;
    uniqueCards: number;
    estimatedValue: number;
    categoryBreakdown: Array<{
      category: string;
      count: number;
      unique: number;
    }>;
  };
  loading?: boolean;
}

export default function DeckAnalysis({ deck, stats, loading = false }: DeckAnalysisProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Helper function to flatten all printings with category info
  const getAllPrintingsForAnalysis = () => {
    const printings: Array<{
      printingId: string;
      category: 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens';
      name: string;
      quantity: number; // Each printing represents 1 card
      printingDetails?: any;
    }> = [];

    // Add printings from each category
    (deck.hero || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'hero',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    (deck.equipment || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'equipment',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    (deck.maindeck || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'maindeck',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    (deck.inventory || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'inventory',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    (deck.maybeboard || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'maybeboard',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    (deck.tokens || []).forEach(p => printings.push({
      printingId: p.printingId,
      category: 'tokens',
      name: p.printingDetails?.display_name || p.printingDetails?.name || `Card ${p.printingId}`,
      quantity: 1,
      printingDetails: p.printingDetails
    }));

    return printings;
  };

  // Get all printings for analysis
  const allPrintings = getAllPrintingsForAnalysis();

  // Analyze deck composition
  const colorBreakdown = allPrintings.reduce((acc, card) => {
    const color = card.printingDetails?.color || 'colorless';
    acc[color] = (acc[color] || 0) + card.quantity;
    return acc;
  }, {} as Record<string, number>);

  const costBreakdown = allPrintings.reduce((acc, card) => {
    const cost = card.printingDetails?.cost;
    if (cost !== undefined && cost !== null) {
      const costBucket = cost === 0 ? '0' : 
                        cost <= 2 ? '1-2' :
                        cost <= 4 ? '3-4' :
                        cost <= 6 ? '5-6' : '7+';
      acc[costBucket] = (acc[costBucket] || 0) + card.quantity;
    }
    return acc;
  }, {} as Record<string, number>);

  const pitchBreakdown = allPrintings.reduce((acc, card) => {
    const pitch = card.printingDetails?.pitch;
    if (pitch !== undefined && pitch !== null) {
      const pitchValue = pitch.toString();
      acc[pitchValue] = (acc[pitchValue] || 0) + card.quantity;
    }
    return acc;
  }, {} as Record<string, number>);

  const typeBreakdown = allPrintings.reduce((acc, card) => {
    const typeText = card.printingDetails?.type_text || 'unknown';
    // Simplify type text for analysis
    const primaryType = typeText.split(' ')[0].toLowerCase();
    acc[primaryType] = (acc[primaryType] || 0) + card.quantity;
    return acc;
  }, {} as Record<string, number>);

  const rarityBreakdown = allPrintings.reduce((acc, card) => {
    const rarity = card.printingDetails?.rarity || 'unknown';
    acc[rarity] = (acc[rarity] || 0) + card.quantity;
    return acc;
  }, {} as Record<string, number>);

  // Get most expensive cards
  const expensiveCards = allPrintings
    .filter(card => card.printingDetails?.tcg_low)
    .map(card => ({
      ...card,
      id: card.printingId, // Add id for key prop
      totalValue: (card.printingDetails?.tcg_low || 0) * card.quantity
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  // Color mapping
  const getColorDot = (color: string) => {
    const colors = {
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'yellow': 'bg-yellow-500',
      'colorless': 'bg-gray-400'
    };
    return colors[color] || 'bg-gray-400';
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      'C': 'bg-gray-500',
      'R': 'bg-blue-500',
      'S': 'bg-purple-500',
      'M': 'bg-yellow-500',
      'L': 'bg-orange-500',
      'F': 'bg-red-500'
    };
    return colors[rarity.toUpperCase()] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCards}</div>
            <p className="text-xs text-muted-foreground">
              {stats.uniqueCards} unique
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Main Deck</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.categoryBreakdown.find(c => c.category === 'maindeck')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              cards in main deck
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.categoryBreakdown.find(c => c.category === 'equipment')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              equipment pieces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.estimatedValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              market estimate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Color Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(colorBreakdown).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No color data available
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(colorBreakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([color, count]) => {
                    const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                    
                    return (
                      <div key={color} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", getColorDot(color))} />
                            <span className="font-medium capitalize">{color}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {count} ({percentage.toFixed(0)}%)
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full transition-all", getColorDot(color))}
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

        {/* Cost Curve */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cost Curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(costBreakdown).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No cost data available
              </div>
            ) : (
              <div className="space-y-3">
                {['0', '1-2', '3-4', '5-6', '7+'].map((costRange) => {
                  const count = costBreakdown[costRange] || 0;
                  const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                  
                  return (
                    <div key={costRange} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{costRange} cost</span>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {count} ({percentage.toFixed(0)}%)
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
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

        {/* Pitch Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Pitch Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(pitchBreakdown).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No pitch data available
              </div>
            ) : (
              <div className="space-y-3">
                {['1', '2', '3'].map((pitch) => {
                  const count = pitchBreakdown[pitch] || 0;
                  const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                  
                  return (
                    <div key={pitch} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Pitch {pitch}</span>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {count} ({percentage.toFixed(0)}%)
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-yellow-500 transition-all"
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

        {/* Rarity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rarity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(rarityBreakdown).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No rarity data available
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(rarityBreakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([rarity, count]) => {
                    const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                    
                    return (
                      <div key={rarity} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", getRarityColor(rarity))} />
                            <span className="font-medium uppercase">{rarity}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {count} ({percentage.toFixed(0)}%)
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full transition-all", getRarityColor(rarity))}
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
      </div>

      {/* Most Expensive Cards */}
      {expensiveCards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Most Expensive Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expensiveCards.map((card, index) => (
                <div key={card.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-4">
                      {index + 1}.
                    </span>
                    <div>
                      <div className="font-medium">{card.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {card.quantity}x @ ${(card.printingDetails?.tcg_low || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600 dark:text-green-400">
                      ${card.totalValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// // components/deck/DeckAnalysis.tsx
// "use client";

// import React from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { 
//   BarChart3, 
//   PieChart, 
//   TrendingUp, 
//   Target,
//   Zap,
//   Shield,
//   Layers,
//   DollarSign
// } from "lucide-react";
// import { cn } from "@/lib/utils";

// interface DeckAnalysisProps {
//   deck: {
//     _id: string;
//     name: string;
//     format: string;
//     hero?: string;
//     cards: Array<{
//       id: string;
//       cardId: string;
//       name: string;
//       quantity: number;
//       category: 'hero' | 'equipment' | 'main' | 'sideboard';
//       printingDetails?: {
//         color?: string;
//         type_text?: string;
//         cost?: number;
//         pitch?: number;
//         tcg_market?: number;
//         rarity?: string;
//       };
//     }>;
//   };
//   stats: {
//     totalCards: number;
//     uniqueCards: number;
//     estimatedValue: number;
//     categoryBreakdown: Array<{
//       category: string;
//       count: number;
//       unique: number;
//     }>;
//   };
//   loading?: boolean;
// }

// export default function DeckAnalysis({ deck, stats, loading = false }: DeckAnalysisProps) {
//   if (loading) {
//     return (
//       <div className="space-y-6">
//         <div className="animate-pulse">
//           <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
//         </div>
//       </div>
//     );
//   }

//   // Analyze deck composition
//   const colorBreakdown = deck.cards.reduce((acc, card) => {
//     const color = card.printingDetails?.color || 'colorless';
//     acc[color] = (acc[color] || 0) + card.quantity;
//     return acc;
//   }, {} as Record<string, number>);

//   const costBreakdown = deck.cards.reduce((acc, card) => {
//     const cost = card.printingDetails?.cost;
//     if (cost !== undefined && cost !== null) {
//       const costBucket = cost === 0 ? '0' : 
//                         cost <= 2 ? '1-2' :
//                         cost <= 4 ? '3-4' :
//                         cost <= 6 ? '5-6' : '7+';
//       acc[costBucket] = (acc[costBucket] || 0) + card.quantity;
//     }
//     return acc;
//   }, {} as Record<string, number>);

//   const pitchBreakdown = deck.cards.reduce((acc, card) => {
//     const pitch = card.printingDetails?.pitch;
//     if (pitch !== undefined && pitch !== null) {
//       const pitchValue = pitch.toString();
//       acc[pitchValue] = (acc[pitchValue] || 0) + card.quantity;
//     }
//     return acc;
//   }, {} as Record<string, number>);

//   const typeBreakdown = deck.cards.reduce((acc, card) => {
//     const typeText = card.printingDetails?.type_text || 'unknown';
//     // Simplify type text for analysis
//     const primaryType = typeText.split(' ')[0].toLowerCase();
//     acc[primaryType] = (acc[primaryType] || 0) + card.quantity;
//     return acc;
//   }, {} as Record<string, number>);

//   const rarityBreakdown = deck.cards.reduce((acc, card) => {
//     const rarity = card.printingDetails?.rarity || 'unknown';
//     acc[rarity] = (acc[rarity] || 0) + card.quantity;
//     return acc;
//   }, {} as Record<string, number>);

//   // Get most expensive cards
//   const expensiveCards = deck.cards
//     .filter(card => card.printingDetails?.tcg_market)
//     .map(card => ({
//       ...card,
//       totalValue: (card.printingDetails?.tcg_market || 0) * card.quantity
//     }))
//     .sort((a, b) => b.totalValue - a.totalValue)
//     .slice(0, 5);

//   // Color mapping
//   const getColorDot = (color: string) => {
//     const colors = {
//       'red': 'bg-red-500',
//       'blue': 'bg-blue-500',
//       'yellow': 'bg-yellow-500',
//       'colorless': 'bg-gray-400'
//     };
//     return colors[color] || 'bg-gray-400';
//   };

//   const getRarityColor = (rarity: string) => {
//     const colors = {
//       'C': 'bg-gray-500',
//       'R': 'bg-blue-500',
//       'S': 'bg-purple-500',
//       'M': 'bg-yellow-500',
//       'L': 'bg-orange-500',
//       'F': 'bg-red-500'
//     };
//     return colors[rarity.toUpperCase()] || 'bg-gray-500';
//   };

//   return (
//     <div className="space-y-6">
//       {/* Overview Stats */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
//             <Layers className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{stats.totalCards}</div>
//             <p className="text-xs text-muted-foreground">
//               {stats.uniqueCards} unique
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Main Deck</CardTitle>
//             <Target className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {stats.categoryBreakdown.find(c => c.category === 'main')?.count || 0}
//             </div>
//             <p className="text-xs text-muted-foreground">
//               cards in main deck
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Equipment</CardTitle>
//             <Shield className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {stats.categoryBreakdown.find(c => c.category === 'equipment')?.count || 0}
//             </div>
//             <p className="text-xs text-muted-foreground">
//               equipment pieces
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Est. Value</CardTitle>
//             <DollarSign className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-green-600">
//               ${stats.estimatedValue.toFixed(2)}
//             </div>
//             <p className="text-xs text-muted-foreground">
//               market estimate
//             </p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Breakdown Charts */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Color Breakdown */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <PieChart className="h-5 w-5" />
//               Color Distribution
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {Object.keys(colorBreakdown).length === 0 ? (
//               <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//                 No color data available
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {Object.entries(colorBreakdown)
//                   .sort(([,a], [,b]) => b - a)
//                   .map(([color, count]) => {
//                     const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                    
//                     return (
//                       <div key={color} className="space-y-1">
//                         <div className="flex items-center justify-between">
//                           <div className="flex items-center gap-2">
//                             <div className={cn("w-3 h-3 rounded-full", getColorDot(color))} />
//                             <span className="font-medium capitalize">{color}</span>
//                           </div>
//                           <div className="text-sm text-gray-600 dark:text-gray-400">
//                             {count} ({percentage.toFixed(0)}%)
//                           </div>
//                         </div>
//                         <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
//                           <div
//                             className={cn("h-2 rounded-full transition-all", getColorDot(color))}
//                             style={{ width: `${percentage}%` }}
//                           />
//                         </div>
//                       </div>
//                     );
//                   })}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Cost Curve */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <BarChart3 className="h-5 w-5" />
//               Cost Curve
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {Object.keys(costBreakdown).length === 0 ? (
//               <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//                 No cost data available
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {['0', '1-2', '3-4', '5-6', '7+'].map((costRange) => {
//                   const count = costBreakdown[costRange] || 0;
//                   const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                  
//                   return (
//                     <div key={costRange} className="space-y-1">
//                       <div className="flex items-center justify-between">
//                         <span className="font-medium">{costRange} cost</span>
//                         <div className="text-sm text-gray-600 dark:text-gray-400">
//                           {count} ({percentage.toFixed(0)}%)
//                         </div>
//                       </div>
//                       <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
//                         <div
//                           className="h-2 rounded-full bg-blue-500 transition-all"
//                           style={{ width: `${percentage}%` }}
//                         />
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Pitch Distribution */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Zap className="h-5 w-5" />
//               Pitch Distribution
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {Object.keys(pitchBreakdown).length === 0 ? (
//               <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//                 No pitch data available
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {['1', '2', '3'].map((pitch) => {
//                   const count = pitchBreakdown[pitch] || 0;
//                   const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                  
//                   return (
//                     <div key={pitch} className="space-y-1">
//                       <div className="flex items-center justify-between">
//                         <span className="font-medium">Pitch {pitch}</span>
//                         <div className="text-sm text-gray-600 dark:text-gray-400">
//                           {count} ({percentage.toFixed(0)}%)
//                         </div>
//                       </div>
//                       <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
//                         <div
//                           className="h-2 rounded-full bg-yellow-500 transition-all"
//                           style={{ width: `${percentage}%` }}
//                         />
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Rarity Breakdown */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <TrendingUp className="h-5 w-5" />
//               Rarity Breakdown
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {Object.keys(rarityBreakdown).length === 0 ? (
//               <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//                 No rarity data available
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {Object.entries(rarityBreakdown)
//                   .sort(([,a], [,b]) => b - a)
//                   .map(([rarity, count]) => {
//                     const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                    
//                     return (
//                       <div key={rarity} className="space-y-1">
//                         <div className="flex items-center justify-between">
//                           <div className="flex items-center gap-2">
//                             <div className={cn("w-3 h-3 rounded-full", getRarityColor(rarity))} />
//                             <span className="font-medium uppercase">{rarity}</span>
//                           </div>
//                           <div className="text-sm text-gray-600 dark:text-gray-400">
//                             {count} ({percentage.toFixed(0)}%)
//                           </div>
//                         </div>
//                         <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
//                           <div
//                             className={cn("h-2 rounded-full transition-all", getRarityColor(rarity))}
//                             style={{ width: `${percentage}%` }}
//                           />
//                         </div>
//                       </div>
//                     );
//                   })}
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>

//       {/* Most Expensive Cards */}
//       {expensiveCards.length > 0 && (
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <DollarSign className="h-5 w-5" />
//               Most Expensive Cards
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-3">
//               {expensiveCards.map((card, index) => (
//                 <div key={card.id} className="flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <span className="text-sm text-gray-500 dark:text-gray-400 w-4">
//                       {index + 1}.
//                     </span>
//                     <div>
//                       <div className="font-medium">{card.name}</div>
//                       <div className="text-sm text-gray-600 dark:text-gray-400">
//                         {card.quantity}x @ ${(card.printingDetails?.tcg_market || 0).toFixed(2)}
//                       </div>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <div className="font-semibold text-green-600 dark:text-green-400">
//                       ${card.totalValue.toFixed(2)}
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// }
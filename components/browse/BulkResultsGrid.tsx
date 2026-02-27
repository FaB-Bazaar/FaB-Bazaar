//BulkResultsGrid.tsx
"use client";

import React from "react";
import BulkResultCard from '@/components/browse/BulkResultCard'; 


interface BulkResultsGridProps {
  cards: any[];
  loading: boolean;
  onUpdatePrinting: (instanceId: string, newPrinting: any) => void;
  onQuantityChange: (instanceId: string, newQuantity: number) => void;
  onToggleTrade: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void; 
  onRemove: (instanceId: string) => void;
  onToggleStaged: (instanceId: string) => void;
  onPrintingView: (instanceId: string) => void;
}

export default function BulkResultsGrid({ 
  cards, 
  loading, 
  onUpdatePrinting, 
  onQuantityChange, 
  onToggleTrade, 
  onDuplicate, 
  onRemove,
  onToggleStaged,
  onPrintingView
}: BulkResultsGridProps) {
  


  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading search results...</div>;
  }
  
  const gridCards = cards.filter(c => !c.isStaged);

  if (gridCards.length === 0) {
    if (cards.length > 0) {
       return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>All found cards have been staged.</p>
            <p className="text-sm">Check the sidebar to manage your import list.</p>
        </div>
       );
    }
    return null;
  }
  
  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {gridCards.length} new card(s). Stage them for import or check the sidebar for your full list.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {gridCards.map((cardInstance) => (
          <BulkResultCard
            key={cardInstance.instanceId}
            cardInstance={cardInstance}
            // Pass all handlers directly down to the card
            onPrintingView={onPrintingView}
            onQuantityChange={onQuantityChange}
            onToggleTrade={onToggleTrade}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onToggleStaged={onToggleStaged} 
          />
        ))}
      </div>

      {/* The Dialog is now rendered on the parent page (app/browse/page.tsx) */}
    </>
  );
}

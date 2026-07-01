// components/browse/PendingImportSidebar.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, Layers, Plus, Minus, CheckCircle2, XCircle } from "lucide-react";
import { 
  getSetName, 
  getFoilingName, 
  getEditionName, 
  getVariantBadgeStyles // --- FIX: Imported the missing function
} from "@/lib/fab-formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface PendingImportSidebarProps {
  allCards: any[];
  onUpdateQuantity: (instanceId: string, newQuantity: number) => void;
  onUnstage: (instanceId: string) => void;
  onClear: () => void;
  onPrintingView: (instanceId: string) => void;
  onSetAllForTrade: (value: boolean) => void;
  onToggleTrade: (instanceId: string) => void;
}

const calculateTotalQuantity = (items: any[]) => {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
};

export default function PendingImportSidebar({
  allCards,
  onUpdateQuantity,
  onUnstage,
  onClear,
  onPrintingView,
  onSetAllForTrade,
  onToggleTrade,
}: PendingImportSidebarProps) {
  const stagedCards = allCards.filter(c => c.isStaged);

  return (
    <div className="hidden lg:flex fixed left-0 top-16 w-96 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 flex-col z-20">
      <div className="p-4 border-b border-gray-300 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pending Import
          </h2>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {calculateTotalQuantity(stagedCards)} Cards
          </span>
        </div>
        {stagedCards.length > 0 && (
          <div className="space-y-2 mt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetAllForTrade(true)}
                className="flex-1 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                All For Trade
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetAllForTrade(false)}
                className="flex-1 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                All Not For Trade
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={onClear} className="w-full">
              Clear Import List
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {stagedCards.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-4">
            Click the "To Stage" button on cards from the search results to add them here.
          </p>
        ) : (
          stagedCards.map(instance => {
            const { selectedPrinting: p } = instance;
            return (
              <div key={instance.instanceId} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-300 dark:border-gray-700">
                <img
                  src={p.image_url || "/cardback.webp"}
                  alt={p.display_name}
                  className="w-16 h-[89px] object-cover rounded-md border border-gray-300 dark:border-gray-600 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div 
                    className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                    onClick={() => onPrintingView(instance.instanceId)}
                    title={p.display_name}
                  >
                    {p.display_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {getSetName(p.set)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-medium">
                      {getEditionName(p.edition) || 'Normal'}
                    </Badge>
                    <div className={cn(
                      "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                      getVariantBadgeStyles(p.rarity, p.foiling) // This will now work
                    )}>
                      {getFoilingName(p.foiling, p.is_extended_art)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      id={`trade-${instance.instanceId}`}
                      checked={instance.forTrade}
                      onCheckedChange={() => onToggleTrade(instance.instanceId)}
                      className="scale-75"
                    />
                    <label
                      htmlFor={`trade-${instance.instanceId}`}
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      For Trade
                    </label>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between self-stretch">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" onClick={() => onUnstage(instance.instanceId)} title="Remove from list">
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1.5">
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="h-7 w-7" 
                      onClick={() => onUpdateQuantity(instance.instanceId, Math.max(1, instance.quantity - 1))} 
                      disabled={instance.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold text-center w-8 text-lg text-gray-900 dark:text-gray-100">{instance.quantity}</span>
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="h-7 w-7" 
                      onClick={() => onUpdateQuantity(instance.instanceId, instance.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
// components/browse/MobileStagedSheet.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus, UploadCloud, Heart, CheckCircle2, XCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  getSetName,
  getFoilingName,
  getEditionName,
  getVariantBadgeStyles
} from "@/lib/fab-formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";

interface MobileStagedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCards: any[];
  onUpdateQuantity: (instanceId: string, newQuantity: number) => void;
  onUnstage: (instanceId: string) => void;
  onClear: () => void;
  onPrintingView: (instanceId: string) => void;
  // Import actions
  binders: any[];
  selectedBinderSlug: string;
  onSelectBinder: (slug: string) => void;
  onAddToBinder: () => void;
  onAddToWants: () => void;
  isImporting: boolean;
  onSetAllForTrade: (value: boolean) => void;
  onToggleTrade: (instanceId: string) => void;
}

const calculateTotalQuantity = (items: any[]) => {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
};

export default function MobileStagedSheet({
  open,
  onOpenChange,
  allCards,
  onUpdateQuantity,
  onUnstage,
  onClear,
  onPrintingView,
  binders,
  selectedBinderSlug,
  onSelectBinder,
  onAddToBinder,
  onAddToWants,
  isImporting,
  onSetAllForTrade,
  onToggleTrade,
}: MobileStagedSheetProps) {
  const stagedCards = allCards.filter(c => c.isStaged);
  const totalQuantity = calculateTotalQuantity(stagedCards);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[85vw] sm:w-96 flex flex-col lg:hidden p-0">
        <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SheetTitle className="text-lg font-semibold">Pending Import</SheetTitle>
          <SheetDescription className="text-sm text-gray-500 dark:text-gray-400">
            {totalQuantity} card{totalQuantity !== 1 ? 's' : ''} ready to import
          </SheetDescription>
        </SheetHeader>

        {stagedCards.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetAllForTrade(true)}
                className="flex-1 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                <span className="text-xs">For Trade</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetAllForTrade(false)}
                className="flex-1 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <XCircle className="h-4 w-4 mr-1" />
                <span className="text-xs">Not For Trade</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {stagedCards.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-8">
              No cards staged yet. Click "To Stage" on cards from the search results.
            </p>
          ) : (
            stagedCards.map(instance => {
              const { selectedPrinting: p } = instance;
              return (
                <div key={instance.instanceId} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex gap-3 mb-3">
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

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5">
                          {getEditionName(p.edition) || 'Normal'}
                        </Badge>
                        <div className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                          getVariantBadgeStyles(p.rarity, p.foiling)
                        )}>
                          {getFoilingName(p.foiling, p.is_extended_art)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900/50 rounded">
                    <Switch
                      id={`trade-mobile-${instance.instanceId}`}
                      checked={instance.forTrade}
                      onCheckedChange={() => onToggleTrade(instance.instanceId)}
                      className="scale-75"
                    />
                    <label
                      htmlFor={`trade-mobile-${instance.instanceId}`}
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      For Trade
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(instance.instanceId, Math.max(1, instance.quantity - 1))}
                        disabled={instance.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-bold text-center w-8 text-lg text-gray-900 dark:text-gray-100">{instance.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(instance.instanceId, instance.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                      onClick={() => onUnstage(instance.instanceId)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {stagedCards.length > 0 && (
          <SheetFooter className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="w-full">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Select Binder
              </label>
              <Select value={selectedBinderSlug} onValueChange={onSelectBinder}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a binder..." />
                </SelectTrigger>
                <SelectContent>
                  {binders.map(b => <SelectItem key={b._id} value={b.slug}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 w-full">
              <Button
                onClick={onAddToWants}
                disabled={isImporting}
                variant="outline"
                className="flex-1"
              >
                <Heart className="mr-2 h-4 w-4" />
                {isImporting ? 'Adding...' : 'To Wants'}
              </Button>
              <Button
                onClick={onAddToBinder}
                disabled={isImporting || !selectedBinderSlug}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                {isImporting ? 'Importing...' : 'To Binder'}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

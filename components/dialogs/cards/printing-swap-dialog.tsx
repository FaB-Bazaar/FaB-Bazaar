/**
 * Unified Printing Swap Dialog
 *
 * A reusable component for swapping card printings across different contexts:
 * - Binder cards
 * - Wants list items
 * - Deck printings
 *
 * The component handles fetching printings and displaying the selection UI,
 * while delegating the actual swap operation to the parent via onSwap callback.
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { RarityIcon } from "@/components/shared/RarityIcon";
import { FOILING_MAP, EDITION_MAP, sortPrintings as sortPrintingsCanonical } from "@/lib/fab-constants";
import { sortPrintingsByLanguage, languageFlag } from "@/lib/utils/printing-language";

// ====================================
// Types
// ====================================

/**
 * Printing option from the search API
 */
export interface PrintingOption {
  printing_id: string;
  collector_number?: string;
  card_unique_id?: string;
  name?: string;
  display_name?: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  image_url?: string;
  is_extended_art?: boolean;
  language?: string | null;
  art_variations?: string[] | null;
}

/**
 * Information needed to identify the current card/printing
 */
export interface CurrentPrintingInfo {
  /** Current printing ID */
  printingId: string;
  /** Card unique ID (for fetching all printings) */
  cardUniqueId?: string;
  /** Display name for the dialog title */
  cardName?: string;
}

/**
 * Result of a swap operation
 */
export interface SwapResult {
  success: boolean;
  error?: string;
}

/**
 * Props for the unified PrintingSwapDialog
 */
export interface PrintingSwapDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current printing information */
  currentPrinting: CurrentPrintingInfo;
  /**
   * Callback to perform the swap operation.
   * The parent component handles the actual API call based on context.
   *
   * @param newPrinting - The printing option selected by the user
   * @returns Promise resolving to swap result
   */
  onSwap: (newPrinting: PrintingOption) => Promise<SwapResult>;
  /**
   * Callback when swap completes successfully.
   * Called after onSwap returns success.
   * Receives the new printing that was selected.
   */
  onSwapComplete?: (newPrinting: PrintingOption) => void;
  /**
   * Optional callback for optimistic updates.
   * Called immediately when user selects a printing, before the API call.
   */
  onOptimisticSwap?: (newPrinting: PrintingOption) => void;
}

// ====================================
// Helper Functions
// ====================================

const FOIL_BADGE_CLASSES: Record<string, string> = {
  r: "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white",
  c: "bg-blue-600 text-white",
  g: "bg-yellow-500 text-black",
  s: "bg-gray-500 text-white",
};

const getFoilingInfo = (foiling: string) => {
  const code = foiling?.toLowerCase();
  return {
    name: (FOILING_MAP as Record<string, string>)[code] || "Non-foil",
    className: FOIL_BADGE_CLASSES[code] || "bg-gray-500 text-white",
  };
};

const getEditionName = (edition: string) =>
  (EDITION_MAP as Record<string, string>)[edition?.toLowerCase()] || edition || "Unknown";

const formatPrice = (price?: number) => {
  return price ? `$${price.toFixed(2)}` : "N/A";
};

// Same ordering as the binder add-card dialog (CardSearchDialog): canonical
// printing order (curated set ranking, gold foils / Marvels last, …) grouped
// by language with English first.
const sortPrintings = (printings: PrintingOption[]): PrintingOption[] =>
  sortPrintingsByLanguage(sortPrintingsCanonical(printings));

// ====================================
// Component
// ====================================

const PrintingSwapDialog: React.FC<PrintingSwapDialogProps> = ({
  open,
  onOpenChange,
  currentPrinting,
  onSwap,
  onSwapComplete,
  onOptimisticSwap,
}) => {
  const [printings, setPrintings] = useState<PrintingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { printingId, cardUniqueId, cardName } = currentPrinting;

  // Fetch printings when dialog opens
  const fetchPrintings = useCallback(async () => {
    if (!cardUniqueId && !printingId) {
      setError("Unable to determine card or printing ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url: string;

      if (cardUniqueId) {
        // Fetch by card unique ID (preferred) - filters by name + color combination
        // Use the same endpoint as browse page for consistency
        url = `/api/printings/search?cardUniqueId=${encodeURIComponent(cardUniqueId)}&limit=50&show=browse_bulk`;
      } else {
        // Fallback: fetch by printing ID to get card unique ID first
        // This ensures we get the correct name+color combination for multi-color cards
        url = `/api/printings/search?printingId=${encodeURIComponent(printingId)}&limit=1&show=browse_bulk`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch printings");
      }

      const data = await response.json();

      // Handle fallback: extract card_unique_id and fetch all matching printings
      if (!cardUniqueId && data.success && data.data?.printings?.[0]?.card_unique_id) {
        // Got card unique ID from printing lookup, now fetch all printings for this specific card
        const cardId = data.data.printings[0].card_unique_id;
        console.log(`[PrintingSwapDialog] Using fallback - fetched card_unique_id: ${cardId} from printingId: ${printingId}`);

        const allPrintingsResponse = await fetch(
          `/api/printings/search?cardUniqueId=${encodeURIComponent(cardId)}&limit=50&show=browse_bulk`
        );

        if (!allPrintingsResponse.ok) {
          throw new Error("Failed to fetch all printings for card");
        }

        const allPrintingsData = await allPrintingsResponse.json();

        if (allPrintingsData.success && allPrintingsData.data?.printings) {
          console.log(`[PrintingSwapDialog] Found ${allPrintingsData.data.printings.length} printings for card_unique_id: ${cardId}`);
          setPrintings(sortPrintings(allPrintingsData.data.printings));
        } else {
          throw new Error("Invalid response format from card printings query");
        }
      } else if (!cardUniqueId && data.success && data.data?.printings?.[0]) {
        // Fallback failed to get card_unique_id - warn user and show what we found
        console.warn(`[PrintingSwapDialog] Warning: card_unique_id not found for printingId: ${printingId}. This may show incorrect results for multi-color cards.`);
        console.warn('[PrintingSwapDialog] Printing data:', data.data.printings[0]);
        setPrintings(sortPrintings(data.data.printings));
      } else if (data.success && data.data?.printings) {
        console.log(`[PrintingSwapDialog] Found ${data.data.printings.length} printings for card_unique_id: ${cardUniqueId}`);
        setPrintings(sortPrintings(data.data.printings));
      } else {
        throw new Error("Invalid response format - no printings data returned");
      }
    } catch (err) {
      console.error("[PrintingSwapDialog] Error fetching printings:", err);
      setError(err instanceof Error ? err.message : "Failed to load printings");
    } finally {
      setLoading(false);
    }
  }, [cardUniqueId, printingId]);

  useEffect(() => {
    if (open) {
      fetchPrintings();
    } else {
      // Reset state when dialog closes
      setPrintings([]);
      setError(null);
    }
  }, [open, fetchPrintings]);

  const handleSelectPrinting = async (newPrinting: PrintingOption) => {
    // If same printing selected, just close
    if (newPrinting.printing_id === printingId) {
      onOpenChange(false);
      return;
    }

    setSwapping(true);
    setError(null);

    try {
      // Call optimistic update if provided
      if (onOptimisticSwap) {
        onOptimisticSwap(newPrinting);
      }

      // Perform the swap via parent callback
      const result = await onSwap(newPrinting);

      if (!result.success) {
        throw new Error(result.error || "Failed to swap printing");
      }

      // Success!
      if (onSwapComplete) {
        onSwapComplete(newPrinting);
      }
      onOpenChange(false);
    } catch (err) {
      console.error("[PrintingSwapDialog] Swap error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setSwapping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Change Printing: {cardName || "Unknown Card"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Loading printings...
              </span>
            </div>
          ) : printings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No printings found
              </p>
              {printingId && (
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                  Current printing ID: {printingId}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {printings.map((printing) => {
                const isCurrentPrinting = printing.printing_id === printingId;
                const foilingInfo = getFoilingInfo(printing.foiling);
                const lang = (printing.language || "en").toLowerCase();
                const artVariations = printing.art_variations ?? [];

                return (
                  <button
                    key={printing.printing_id}
                    onClick={() => handleSelectPrinting(printing)}
                    disabled={swapping || isCurrentPrinting}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      isCurrentPrinting
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-300 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    } ${swapping ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 uppercase">
                          {printing.set?.toUpperCase()}
                        </span>
                        <RarityIcon rarityCode={printing.rarity} size="sm" />
                        <span aria-label={`Language: ${lang}`}>
                          {languageFlag(lang)}
                          <span className="ml-1 text-xs uppercase text-gray-500 dark:text-gray-400">
                            {lang}
                          </span>
                        </span>
                        {isCurrentPrinting && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      {printing.collector_number && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {printing.collector_number}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs px-2 py-0.5 ${foilingInfo.className}`}
                      >
                        {foilingInfo.name}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getEditionName(printing.edition)}
                      </Badge>
                      {(artVariations.length > 0 || printing.is_extended_art) && (
                        <Badge variant="outline" className="text-xs">
                          {artVariations.includes("EA") || printing.is_extended_art
                            ? "Extended Art"
                            : artVariations[0]}
                        </Badge>
                      )}
                    </div>

                    {/* tcg_low is THE price (see CLAUDE.md); market only as a
                        labeled fallback when no low exists — never the reverse */}
                    {printing.tcg_low != null ? (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        TCG Low: {formatPrice(printing.tcg_low)}
                      </div>
                    ) : printing.tcg_market != null ? (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Market: {formatPrice(printing.tcg_market)}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={swapping}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintingSwapDialog;

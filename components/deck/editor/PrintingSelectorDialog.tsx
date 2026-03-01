"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { decksClient } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import type { DeckPrintingDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";

// ─── Utilities ────────────────────────────────────────────────────────────────

function getPrintingLabel(p: any): string {
  if (!p) return "?";
  const num = p.collector_number || p.set?.toUpperCase() || "?";
  const parts: string[] = [num];
  if (p.edition === "f") parts.push("1st");
  else if (p.edition === "u") parts.push("U");
  if (p.rarity === "v") return [...parts, "Marvel"].join(" ");
  if (p.is_extended_art) parts.push("EA");
  if (p.foiling === "c") parts.push("CF");
  else if (p.foiling === "r") parts.push("RF");
  else if (p.foiling === "g") parts.push("GF");
  return parts.join(" ");
}

function sortPrintings(printings: any[]): any[] {
  const editionOrder: Record<string, number> = { a: 0, f: 1, u: 2, n: 3 };
  const variantOrder: Record<string, number> = { v: 0, ea: 1, c: 2, r: 3, s: 4 };
  const variantKey = (p: any) =>
    p.rarity === "v" ? 0 : p.is_extended_art ? 1 : variantOrder[p.foiling] ?? 99;

  return [...printings].sort((a, b) => {
    if ((a.set || "") < (b.set || "")) return -1;
    if ((a.set || "") > (b.set || "")) return 1;
    const edA = editionOrder[a.edition] ?? 99;
    const edB = editionOrder[b.edition] ?? 99;
    if (edA !== edB) return edA - edB;
    return variantKey(a) - variantKey(b);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PrintingSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  cardUniqueId: string;
  category: DeckCategory;
  deckId: string;
  currentPrintings: DeckPrintingDTO[];
  onApply: () => Promise<void>;
}

export default function PrintingSelectorDialog({
  open,
  onOpenChange,
  cardName,
  cardUniqueId,
  category,
  deckId,
  currentPrintings,
  onApply,
}: PrintingSelectorDialogProps) {
  const { toast } = useToast();
  const [availablePrintings, setAvailablePrintings] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [originalQuantities, setOriginalQuantities] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hoveredPrinting, setHoveredPrinting] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !cardUniqueId) return;
    let cancelled = false;

    const fetchPrintings = async () => {
      setLoading(true);
      setAvailablePrintings([]);
      try {
        const response = await fetch(
          `/api/printings/search?cardUniqueId=${cardUniqueId}&limit=50&show=browse_bulk`
        );
        const data = await response.json();
        if (cancelled) return;

        if (data.success && data.data?.printings) {
          const sorted = sortPrintings(data.data.printings);
          setAvailablePrintings(sorted);

          // Seed quantities: current deck qty, or 0
          const origMap = new Map<string, number>();
          const qtyMap = new Map<string, number>();

          for (const pr of currentPrintings) {
            origMap.set(pr.printingId, pr.quantity ?? 1);
            qtyMap.set(pr.printingId, pr.quantity ?? 1);
          }
          for (const p of sorted) {
            if (!qtyMap.has(p.printing_id)) {
              qtyMap.set(p.printing_id, 0);
              origMap.set(p.printing_id, 0);
            }
          }

          setOriginalQuantities(origMap);
          setQuantities(qtyMap);
        }
      } catch {
        if (!cancelled) toast({ title: "Failed to load printings", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPrintings();
    return () => { cancelled = true; };
  }, [open, cardUniqueId]);

  const setQty = (printingId: string, qty: number) => {
    setQuantities(prev => {
      const next = new Map(prev);
      next.set(printingId, Math.max(0, qty));
      return next;
    });
  };

  const hasChanges = () => {
    for (const [id, qty] of quantities.entries()) {
      if (qty !== (originalQuantities.get(id) ?? 0)) return true;
    }
    return false;
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const removals: Promise<any>[] = [];
      const toAdd: { printingId: string; quantity: number; category: DeckCategory }[] = [];

      for (const [printingId, newQty] of quantities.entries()) {
        const origQty = originalQuantities.get(printingId) ?? 0;
        if (newQty === origQty) continue;
        // Always remove first — addPrintings stacks on existing quantity rather than
        // setting it, so we need a clean slate before re-adding the desired amount.
        if (origQty > 0) {
          removals.push(decksClient.removePrinting(deckId, printingId, category));
        }
        if (newQty > 0) {
          toAdd.push({ printingId, quantity: newQty, category });
        }
      }

      await Promise.all(removals);
      if (toAdd.length > 0) {
        await decksClient.addPrintings(deckId, toAdd);
      }

      await onApply();
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to apply changes", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  // Summary of pending changes
  const changeCount = Array.from(quantities.entries()).filter(
    ([id, qty]) => qty !== (originalQuantities.get(id) ?? 0)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh] gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <DialogTitle className="text-lg">
            Printings — <span className="font-normal text-gray-600 dark:text-gray-400">{cardName}</span>
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-1">
            Hover a row to preview. Click a printing label to swap. Adjust quantities and apply.
          </p>
        </DialogHeader>

        {/* Printing list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : availablePrintings.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No printings found.</p>
          ) : (
            <div className="space-y-2">
              {availablePrintings.map(p => {
                const qty = quantities.get(p.printing_id) ?? 0;
                const origQty = originalQuantities.get(p.printing_id) ?? 0;
                const isInDeck = origQty > 0;
                const isModified = qty !== origQty;

                return (
                  <div
                    key={p.printing_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isModified
                        ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : qty > 0
                        ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {/* Thumbnail — hover triggers large centered preview */}
                    <img
                      src={p.image_url || "/cardback.webp"}
                      alt={p.display_name}
                      className="w-11 h-[61px] object-cover rounded border border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-zoom-in"
                      onMouseEnter={() => setHoveredPrinting(p)}
                      onMouseLeave={() => setHoveredPrinting(null)}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {getPrintingLabel(p)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {p.set_name || p.set?.toUpperCase()}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {p.tcg_low != null && (
                          <span className="text-xs text-gray-400 tabular-nums">
                            ${p.tcg_low.toFixed(2)}
                          </span>
                        )}
                        {isModified ? (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {origQty > 0 ? `${origQty}× → ` : "+"}{qty > 0 ? `${qty}×` : "removed"}
                          </span>
                        ) : isInDeck ? (
                          <span className="text-xs text-green-600 dark:text-green-400">In deck</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Quantity stepper */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQty(p.printing_id, qty - 1)}
                        disabled={qty <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span
                        className={cn(
                          "w-7 text-center font-bold tabular-nums text-sm",
                          qty > 0
                            ? "text-gray-900 dark:text-gray-100"
                            : "text-gray-300 dark:text-gray-600"
                        )}
                      >
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQty(p.printing_id, qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanges() || applying || loading}>
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying…
              </>
            ) : changeCount > 0 ? (
              `Apply ${changeCount} change${changeCount > 1 ? "s" : ""}`
            ) : (
              "No changes"
            )}
          </Button>
        </DialogFooter>

        {/* Hover image preview — centered on screen, pointer-events-none */}
        {hoveredPrinting?.image_url && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none">
            <img
              src={hoveredPrinting.image_url}
              alt={hoveredPrinting.display_name}
              className="w-[240px] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPrintingUpgradeSuggestions,
  applyPrintingUpgrades,
} from "@/lib/client/decks-client";
import { FOILING_STYLES } from "@/lib/fab-constants";
import { cn } from "@/lib/utils";
import type {
  UpgradePrintingSuggestionDTO,
  UpgradePrintingAlternativeDTO,
} from "@/lib/services/contracts/IDeckService";

interface DeckUpgradePrintingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  onApplied: () => void | Promise<void>;
}

type SelectionState = {
  // currentPrintingId -> { accepted, chosenAltPrintingId }
  [currentPrintingId: string]: { accepted: boolean; chosenAltPrintingId: string };
};

function colorTextClass(color: string | null): string {
  if (color === "red") return "text-red-400";
  if (color === "yellow") return "text-yellow-400";
  if (color === "blue") return "text-blue-400";
  return "text-gray-200";
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function printingLabel(p: {
  setCode: string | null;
  foiling: string | null;
  edition: string | null;
  collectorNumber: string | null;
}): string {
  const num = p.collectorNumber || p.setCode?.toUpperCase() || "?";
  const parts: string[] = [num];
  if (p.edition === "f") parts.push("1st");
  else if (p.edition === "u") parts.push("U");
  const foilStyle = p.foiling
    ? FOILING_STYLES[p.foiling as keyof typeof FOILING_STYLES]
    : null;
  if (foilStyle && p.foiling !== "s" && p.foiling !== "n") {
    parts.push(foilStyle.shortName);
  }
  return parts.join(" · ");
}

export default function DeckUpgradePrintingsDialog({
  open,
  onOpenChange,
  deckId,
  onApplied,
}: DeckUpgradePrintingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<UpgradePrintingSuggestionDTO[]>([]);
  const [selection, setSelection] = useState<SelectionState>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSuggestions([]);
    setSelection({});
    getPrintingUpgradeSuggestions(deckId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          toast({ title: "Couldn't load suggestions", description: res.error, variant: "destructive" });
          setSuggestions([]);
          return;
        }
        setSuggestions(res.data);
        const initial: SelectionState = {};
        for (const s of res.data) {
          initial[s.currentPrintingId] = {
            accepted: true,
            chosenAltPrintingId: s.recommendedPrintingId,
          };
        }
        setSelection(initial);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId, toast]);

  const acceptedCount = useMemo(
    () => Object.values(selection).filter((s) => s.accepted).length,
    [selection]
  );

  const valueDelta = useMemo(() => {
    let delta = 0;
    for (const s of suggestions) {
      const sel = selection[s.currentPrintingId];
      if (!sel?.accepted) continue;
      const alt = s.alternatives.find((a) => a.printingId === sel.chosenAltPrintingId);
      if (!alt) continue;
      delta += ((alt.tcgLow ?? 0) - (s.current.tcgLow ?? 0)) * s.deckQuantity;
    }
    return delta;
  }, [suggestions, selection]);

  const toggleRow = (currentPrintingId: string, accepted: boolean) => {
    setSelection((prev) => ({
      ...prev,
      [currentPrintingId]: { ...prev[currentPrintingId], accepted },
    }));
  };

  const chooseAlt = (currentPrintingId: string, altPrintingId: string) => {
    setSelection((prev) => ({
      ...prev,
      [currentPrintingId]: { ...prev[currentPrintingId], chosenAltPrintingId: altPrintingId },
    }));
  };

  const selectAll = (accepted: boolean) => {
    setSelection((prev) => {
      const next: SelectionState = {};
      for (const [id, s] of Object.entries(prev)) {
        next[id] = { ...s, accepted };
      }
      return next;
    });
  };

  const handleApply = async () => {
    const swaps = suggestions
      .map((s) => {
        const sel = selection[s.currentPrintingId];
        if (!sel?.accepted) return null;
        if (sel.chosenAltPrintingId === s.currentPrintingId) return null;
        return {
          currentPrintingId: s.currentPrintingId,
          newPrintingId: sel.chosenAltPrintingId,
          category: s.category,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!swaps.length) {
      toast({ title: "Nothing to apply", description: "Select at least one swap." });
      return;
    }

    setApplying(true);
    const res = await applyPrintingUpgrades(deckId, swaps);
    setApplying(false);

    if (!res.success) {
      toast({ title: "Update failed", description: res.error, variant: "destructive" });
      return;
    }

    toast({
      title: `Updated ${res.data.swapped} card${res.data.swapped !== 1 ? "s" : ""}`,
      description:
        res.data.errors.length > 0
          ? `${res.data.errors.length} swap${res.data.errors.length !== 1 ? "s" : ""} failed.`
          : undefined,
      variant: res.data.errors.length > 0 ? "destructive" : undefined,
    });

    await onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update to owned printings</DialogTitle>
          <DialogDescription className="text-gray-300">
            Swap unowned deck printings for ones you already have. Heroes are excluded — swap those manually.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-300">
            All printings are up to date — no unowned cards have owned alternatives.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-700 pb-2 text-sm">
              <div className="text-gray-300">
                <span className="font-semibold text-white">{acceptedCount}</span>
                {" of "}
                <span>{suggestions.length}</span>
                {" selected"}
                <span className="ml-3 text-gray-400">
                  Net value change:{" "}
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      valueDelta > 0 ? "text-green-400" : valueDelta < 0 ? "text-red-400" : "text-gray-300"
                    )}
                  >
                    {valueDelta >= 0 ? "+" : ""}
                    {formatPrice(valueDelta)}
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => selectAll(true)}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => selectAll(false)}>
                  Deselect all
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <ul className="divide-y divide-gray-800">
                {suggestions.map((s) => {
                  const sel = selection[s.currentPrintingId];
                  const chosen =
                    s.alternatives.find((a) => a.printingId === sel?.chosenAltPrintingId) ??
                    s.alternatives[0];
                  const rowDelta = ((chosen?.tcgLow ?? 0) - (s.current.tcgLow ?? 0)) * s.deckQuantity;
                  const checkboxId = `upgrade-row-${s.currentPrintingId}`;

                  return (
                    <li
                      key={s.currentPrintingId}
                      className={cn("flex items-center gap-3 py-3", !sel?.accepted && "opacity-60")}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={sel?.accepted ?? false}
                        onCheckedChange={(v) => toggleRow(s.currentPrintingId, v === true)}
                        aria-label={`Swap ${s.cardName}`}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={checkboxId} className="cursor-pointer">
                          <div className={cn("font-semibold truncate", colorTextClass(s.color))}>
                            {s.deckQuantity > 1 && (
                              <span className="text-gray-300 font-mono mr-1.5">×{s.deckQuantity}</span>
                            )}
                            {s.cardName}
                          </div>
                        </label>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span className="font-mono">{printingLabel(s.current)}</span>
                          <span className="font-mono">{formatPrice(s.current.tcgLow)}</span>
                          <ArrowRight className="h-3 w-3 text-gray-500" aria-hidden />
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              rowDelta > 0 ? "text-green-400" : rowDelta < 0 ? "text-red-400" : "text-gray-300"
                            )}
                          >
                            {rowDelta >= 0 ? "+" : ""}
                            {formatPrice(rowDelta)}
                          </span>
                        </div>
                      </div>
                      <Select
                        value={sel?.chosenAltPrintingId}
                        onValueChange={(v) => chooseAlt(s.currentPrintingId, v)}
                        disabled={!sel?.accepted}
                      >
                        <SelectTrigger className="w-[200px] h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {s.alternatives.map((alt: UpgradePrintingAlternativeDTO) => (
                            <SelectItem key={alt.printingId} value={alt.printingId}>
                              <span className="flex items-center gap-2">
                                {alt.isRecommended && (
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden />
                                )}
                                <span className="font-mono text-xs">{printingLabel(alt)}</span>
                                <span className="text-xs text-gray-400">
                                  ×{alt.ownedQty} · {formatPrice(alt.tcgLow)}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || loading || acceptedCount === 0}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying…
              </>
            ) : (
              `Apply ${acceptedCount} swap${acceptedCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

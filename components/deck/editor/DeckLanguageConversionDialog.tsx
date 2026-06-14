"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  previewDeckLanguageConversion,
  convertDeckToLanguage,
} from "@/lib/client/decks-client";
import { LANGUAGES } from "@/lib/search/build-server-filters";
import { languageFlag } from "@/lib/utils/printing-language";
import type { DeckLanguageConversionPlanDTO } from "@/lib/services/contracts/IDeckService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  onApplied: () => void | Promise<void>;
}

// Default to French; English is offered too (to revert a converted deck).
const DEFAULT_LANG = "fr";

export default function DeckLanguageConversionDialog({ open, onOpenChange, deckId, onApplied }: Props) {
  const { toast } = useToast();
  const [language, setLanguage] = useState(DEFAULT_LANG);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<DeckLanguageConversionPlanDTO | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPlan(null);
    previewDeckLanguageConversion(deckId, language)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          toast({ title: "Couldn't preview conversion", description: res.error, variant: "destructive" });
          return;
        }
        setPlan(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId, language, toast]);

  const convertCount = plan?.swaps.length ?? 0;
  const skipCount = plan?.skipped.length ?? 0;
  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? language.toUpperCase();

  const handleApply = async () => {
    setApplying(true);
    const res = await convertDeckToLanguage(deckId, language);
    setApplying(false);
    if (!res.success) {
      toast({ title: "Conversion failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: `Converted ${res.data.swapped} card${res.data.swapped !== 1 ? "s" : ""} to ${langLabel}`,
      description: res.data.skipped > 0 ? `${res.data.skipped} left as-is (no ${langLabel} printing).` : undefined,
    });
    await onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert deck to a language</DialogTitle>
          <DialogDescription className="text-gray-300">
            Swaps each card to its closest printing in your chosen language — keeping the same foil where
            possible. Cards with no printing in that language are left as-is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">Language</span>
            <Select value={language} onValueChange={setLanguage} disabled={applying}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{languageFlag(l.code)}</span> {l.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking available printings…
              </div>
            ) : (
              <ul className="space-y-1">
                <li className="text-gray-200">
                  <span className="font-semibold text-white">{convertCount}</span> card
                  {convertCount !== 1 ? "s" : ""} will convert to {langLabel}
                </li>
                <li className="text-gray-400">
                  <span className="font-semibold text-gray-200">{skipCount}</span> will stay as-is
                  {skipCount > 0 ? ` (no ${langLabel} printing)` : ""}
                </li>
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={applying || loading || convertCount === 0}>
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Converting…
              </>
            ) : (
              `Convert ${convertCount} card${convertCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

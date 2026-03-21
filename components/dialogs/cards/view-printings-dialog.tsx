"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Check } from "lucide-react";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetName, getFoilingName, getEditionName, getVariantBadgeStyles } from "@/lib/fab-formatters";
import { sortPrintings } from "@/lib/fab-constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TcgAffiliateLink } from '@/components/tracking';

export default function ViewPrintingsDialog({
  open, onOpenChange, cardName, cardUniqueId, onSelectPrinting, currentPrintingId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  cardUniqueId: string;
  onSelectPrinting: (printing: any) => void;
  currentPrintingId?: string;
}) {
  const [printings, setPrintings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>(currentPrintingId);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(currentPrintingId);
  }, [currentPrintingId, open]);

  useEffect(() => {
    if (open && cardUniqueId) {
      setLoading(true);
      setError(null);
      fetch(`/api/printings/search?cardUniqueId=${cardUniqueId}&limit=50&show=browse_bulk`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data?.printings) {
            setPrintings(sortPrintings(data.data.printings));
          } else {
            throw new Error('Could not find other printings.');
          }
        })
        .catch(err => setError(err instanceof Error ? err.message : 'Failed to load printings'))
        .finally(() => setLoading(false));
    }
  }, [open, cardUniqueId]);

  // Scroll selected card into view in the strip
  useEffect(() => {
    if (!selected || !stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-printing="${selected}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selected, printings]);

  const handlePreview = (p: any) => {
    setSelected(p.printing_id);
  };

  const handleConfirm = () => {
    if (!selectedPrinting) return;
    onSelectPrinting(selectedPrinting);
    onOpenChange(false);
  };

  const selectedPrinting = printings.find(p => p.printing_id === selected) ?? printings[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Available Printings: {cardName}</DialogTitle>
          <DialogDescription>
            Click a card image or row to select. Click the price to buy on TCGPlayer.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-center py-8">{error}</p>
        ) : (
          <>
            {/* Image strip */}
            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-gray-600"
              style={{ scrollbarWidth: 'thin' }}
            >
              {printings.map(p => (
                <button
                  key={p.printing_id}
                  data-printing={p.printing_id}
                  onClick={() => handlePreview(p)}
                  className={cn(
                    "relative shrink-0 rounded-lg overflow-hidden transition-all",
                    "w-[90px]",
                    selected === p.printing_id
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800"
                      : "opacity-75 hover:opacity-100 hover:ring-1 hover:ring-gray-400 ring-offset-gray-800"
                  )}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={cardName}
                      className="w-full h-auto block"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center text-gray-500 text-xs">
                      {p.set.toUpperCase()}
                    </div>
                  )}
                  {/* Price badge */}
                  {p.tcg_low != null && p.tcg_low > 0 && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-green-400 text-[11px] font-semibold text-center py-0.5">
                      ${p.tcg_low.toFixed(2)}
                    </div>
                  )}
                  {/* Foiling badge */}
                  {p.foiling && p.foiling !== 's' && (
                    <div className={cn(
                      "absolute top-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded leading-none",
                      getVariantBadgeStyles(p.rarity, p.foiling)
                    )}>
                      {p.foiling === 'r' ? 'RF' : p.foiling === 'c' ? 'CF' : p.foiling.toUpperCase()}
                    </div>
                  )}
                  {/* Selected checkmark */}
                  {selected === p.printing_id && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 text-center -mt-1 mb-1">
              Drag to browse · click a card to select
            </p>

            {/* Selected printing detail */}
            {selectedPrinting && (
              <div className="rounded-lg border border-blue-500 bg-blue-950/40 p-3">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <RarityIcon rarityCode={selectedPrinting.rarity} size="sm" />
                      <span className="font-semibold text-sm text-gray-200">
                        {getSetName(selectedPrinting.set)}
                      </span>
                      <span className="text-xs text-gray-400">({selectedPrinting.set.toUpperCase()})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getEditionName(selectedPrinting.edition) || 'Normal'}
                      </Badge>
                      <div className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                        getVariantBadgeStyles(selectedPrinting.rarity, selectedPrinting.foiling)
                      )}>
                        {getFoilingName(selectedPrinting.foiling, selectedPrinting.is_extended_art)}
                      </div>
                    </div>
                  </div>

                  {selectedPrinting.tcg_low != null && selectedPrinting.tcg_low > 0 && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-lg font-semibold text-green-400">
                        ${selectedPrinting.tcg_low.toFixed(2)}
                      </div>
                      {selectedPrinting.tcgplayer_url && (
                        <TcgAffiliateLink
                          tcgplayerUrl={selectedPrinting.tcgplayer_url}
                          feature="PrintingsDialogPurchase"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded hover:bg-blue-900/20 border border-blue-800/50"
                          title="Purchase on TCGPlayer"
                        >
                          <img
                            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                            alt="TCGPlayer"
                            className="h-3 w-auto"
                          />
                          <span>Buy</span>
                        </TcgAffiliateLink>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleConfirm}
                  className="w-full text-sm py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  {selected === currentPrintingId ? 'Keep this printing' : 'Use this printing'}
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

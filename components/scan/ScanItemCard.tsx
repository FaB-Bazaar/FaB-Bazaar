// components/scan/ScanItemCard.tsx — one photographed card on /scan: preview,
// match confidence, candidate names → pitch → printings, quantity. The
// scanner only identifies ARTWORK; pitch/foiling/edition are the user's pick.
"use client";

import { Check, Trash2, Minus, Plus, AlertTriangle, ImageOff } from "lucide-react";
import { FOILING_MAP, EDITION_MAP, SET_MAP } from "@/lib/fab-constants";
import { matchConfidence, type ScanItem, type ScanCandidate, type ScanPrinting, defaultPrintingChoice } from "@/lib/scan/scan-session";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

const PITCH_LABEL: Record<number, string> = { 1: "Red", 2: "Yellow", 3: "Blue" };
const PITCH_CLASS: Record<number, string> = {
  1: "border-l-red-500",
  2: "border-l-yellow-500",
  3: "border-l-blue-500",
};

function label(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return "";
  return map[code.toLowerCase()] ?? map[code] ?? code.toUpperCase();
}

/** Primary line: the fields that DISTINGUISH printings of one card. */
function printingKey(p: ScanPrinting): string {
  const bits = [p.collectorNumber ?? "", label(FOILING_MAP as Record<string, string>, p.foiling)];
  if (p.artVariations?.length) bits.push(p.artVariations.join("/"));
  if (p.language !== "en") bits.push(p.language.toUpperCase());
  return bits.filter(Boolean).join(" · ");
}
/** Secondary line: set + edition. */
function printingSet(p: ScanPrinting): string {
  return [label(SET_MAP as Record<string, string>, p.set), label(EDITION_MAP as Record<string, string>, p.edition)].filter(Boolean).join(" · ");
}
function printingLine(p: ScanPrinting): string {
  return [printingKey(p), printingSet(p)].filter(Boolean).join(" · ");
}

function ConfidenceBadge({ item }: { item: ScanItem }) {
  if (item.status === "added") return <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-300"><Check className="h-4 w-4" aria-hidden />Added</span>;
  if (item.status === "identifying") return <span className="text-sm text-gray-700 dark:text-gray-300">Identifying…</span>;
  if (item.status === "error") return <span className="inline-flex items-center gap-1 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden />{item.error ?? "Failed"}</span>;
  if (item.status === "no-match") return <span className="inline-flex items-center gap-1 text-sm text-red-700 dark:text-red-300"><ImageOff className="h-4 w-4" aria-hidden />No match</span>;
  const c = matchConfidence(item.bestDistance);
  if (c === "confident") return <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-300"><Check className="h-4 w-4" aria-hidden />Confident match</span>;
  if (c === "plausible") return <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 dark:text-yellow-400"><AlertTriangle className="h-4 w-4" aria-hidden />Check the match</span>;
  return <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden />Weak match — verify</span>;
}

export interface ScanItemCardProps {
  item: ScanItem;
  onChoose: (printingId: string) => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function ScanItemCard({ item, onChoose, onQuantity, onRemove }: ScanItemCardProps) {
  // Which candidate name + card own the chosen printing?
  const owner = (() => {
    for (const cand of item.candidates) for (const card of cand.cards) for (const p of card.printings) {
      if (p.printingId === item.chosenPrintingId) return { cand, card, printing: p };
    }
    const cand = item.candidates[0];
    return cand ? { cand, card: cand.cards[0], printing: cand.cards[0]?.printings[0] } : null;
  })();
  const chosen = owner?.printing ?? null;
  const done = item.status === "added";

  return (
    <li data-testid="scan-item" className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <img src={item.previewUrl} alt="" className="h-28 w-20 sm:h-36 sm:w-26 flex-none rounded object-cover bg-gray-100 dark:bg-gray-900" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <ConfidenceBadge item={item} />
              {owner && (
                <p className="mt-1 truncate text-base font-semibold text-gray-900 dark:text-gray-100" data-testid="scan-item-name">
                  {owner.cand.name}{owner.card?.pitch ? ` (${PITCH_LABEL[owner.card.pitch]})` : ""}
                </p>
              )}
              {chosen && <p className="text-sm text-gray-700 dark:text-gray-300">{printingLine(chosen)}</p>}
            </div>
            <button type="button" onClick={onRemove} aria-label="Remove this photo" className={`flex-none rounded p-2 text-gray-700 hover:text-red-700 dark:text-gray-300 dark:hover:text-red-300 ${FOCUS_RING}`}>
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {!done && item.status !== "identifying" && item.candidates.length > 0 && (
            <>
              {/* Candidate names (art matches) */}
              {item.candidates.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Possible cards">
                  {item.candidates.map((cand) => {
                    const active = cand === owner?.cand;
                    return (
                      <button key={cand.name} type="button" onClick={() => { const id = defaultPrintingChoice(cand); if (id) onChoose(id); }}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-sm ${FOCUS_RING} ${active ? "border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100 font-semibold" : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"}`}>
                        {active ? "✓ " : ""}{cand.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pitch siblings */}
              {owner && owner.cand.cards.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Pitch">
                  {owner.cand.cards.map((card) => {
                    const active = card === owner.card;
                    return (
                      <button key={card.cardUniqueId} type="button" onClick={() => { const p = card.printings.find(x => x.language === "en") ?? card.printings[0]; if (p) onChoose(p.printingId); }}
                        aria-pressed={active}
                        className={`rounded border-l-4 border px-3 py-1 text-sm ${PITCH_CLASS[card.pitch ?? 0] ?? "border-l-gray-400"} ${FOCUS_RING} ${active ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 font-semibold" : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"}`}>
                        {active ? "✓ " : ""}{card.pitch ? PITCH_LABEL[card.pitch] : "No pitch"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Printings of the chosen card */}
              {owner?.card && (
                <PrintingPicker card={owner.card} chosenId={item.chosenPrintingId} onChoose={onChoose} />
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Quantity</span>
                <button type="button" aria-label="Decrease quantity" onClick={() => onQuantity(item.quantity - 1)} className={`rounded border border-gray-300 p-1 dark:border-gray-600 ${FOCUS_RING}`}><Minus className="h-4 w-4" aria-hidden /></button>
                <input type="number" min={1} max={99} value={item.quantity} onChange={(e) => onQuantity(Number(e.target.value))} aria-label="Quantity"
                  className={`w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center text-base dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${FOCUS_RING}`} />
                <button type="button" aria-label="Increase quantity" onClick={() => onQuantity(item.quantity + 1)} className={`rounded border border-gray-300 p-1 dark:border-gray-600 ${FOCUS_RING}`}><Plus className="h-4 w-4" aria-hidden /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function PrintingPicker({ card, chosenId, onChoose }: { card: ScanCandidate["cards"][0]; chosenId: string | null; onChoose: (id: string) => void }) {
  const english = card.printings.filter(p => p.language === "en");
  const others = card.printings.filter(p => p.language !== "en");
  const list = [...english, ...others];
  return (
    <details className="mt-2 group" open={list.length <= 4}>
      <summary className={`cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-300 ${FOCUS_RING}`}>
        Choose printing ({list.length})
      </summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2" role="radiogroup" aria-label="Printing">
        {list.map((p) => {
          const active = p.printingId === chosenId;
          return (
            <li key={p.printingId}>
              <button type="button" role="radio" aria-checked={active} onClick={() => onChoose(p.printingId)}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${FOCUS_RING} ${active ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30" : "border-gray-300 dark:border-gray-600"}`}>
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-12 w-9 flex-none rounded object-cover" loading="lazy" /> : <span className="h-12 w-9 flex-none rounded bg-gray-200 dark:bg-gray-700" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900 dark:text-gray-100">{active ? "✓ " : ""}{printingKey(p)}</span>
                  <span className="block text-gray-700 dark:text-gray-300">{printingSet(p)} · {p.tcgLow != null ? `Low $${p.tcgLow.toFixed(2)}` : "No price"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

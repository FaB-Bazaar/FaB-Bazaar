"use client";

// Stats panel "Ratios": the deck's saved A : B comparisons (decks.metadata.ratios).
// Click a row to compare both sides side by side above the deck; editors can add
// (plain inline form) and remove. Traditional table look, no animation.

import { useState } from "react";
import { X } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { ratioRow, type DeckRatio, type Measure, type MeasureKind } from "@/lib/deck/ratios";
import { TYPE_OPTIONS } from "@/lib/deck/deck-lens";

const KIND_LABEL: Record<MeasureKind, string> = { text: "Card text", type: "Card type", keyword: "Keyword", pitch: "Pitch" };
const PITCH_OPTIONS = [{ value: "1", label: "Red" }, { value: "2", label: "Yellow" }, { value: "3", label: "Blue" }];
const FIELD = "rounded-sm border border-gray-400 bg-white px-1.5 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900";

function defaultValue(kind: MeasureKind): string {
  if (kind === "pitch") return "1";
  if (kind === "type") return TYPE_OPTIONS[0].value;
  return "";
}

function MeasureFields({ which, kind, value, onKind, onValue, allowNone }: {
  which: "First" | "Second";
  kind: MeasureKind | "";
  value: string;
  onKind: (k: MeasureKind | "") => void;
  onValue: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select aria-label={`${which} measure`} value={kind} onChange={e => onKind(e.target.value as MeasureKind | "")} className={FIELD}>
        {allowNone && <option value="">Nothing (show share)</option>}
        {(Object.keys(KIND_LABEL) as MeasureKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
      {kind === "pitch" || kind === "type" ? (
        <select aria-label={`${which} value`} value={value} onChange={e => onValue(e.target.value)} className={FIELD}>
          {(kind === "pitch" ? PITCH_OPTIONS : TYPE_OPTIONS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : kind ? (
        <input
          aria-label={`${which} value`}
          value={value}
          onChange={e => onValue(e.target.value)}
          placeholder={kind === "keyword" ? "e.g. go again" : "e.g. discard"}
          autoComplete="off"
          className={`${FIELD} w-32`}
        />
      ) : null}
    </div>
  );
}

export default function RatiosSection({ deck, ratios, canEdit, activeId, onCompare, onSave }: {
  deck: DeckDTO;
  ratios: DeckRatio[];
  canEdit: boolean;
  activeId: string | null;
  onCompare: (r: DeckRatio) => void;
  onSave: (next: DeckRatio[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [aKind, setAKind] = useState<MeasureKind>("text");
  const [aValue, setAValue] = useState("");
  const [bKind, setBKind] = useState<MeasureKind | "">("text");
  const [bValue, setBValue] = useState("");

  const reset = () => { setAdding(false); setAKind("text"); setAValue(""); setBKind("text"); setBValue(""); };
  const save = () => {
    if (!aValue.trim()) return;
    const a: Measure = { kind: aKind, value: aValue.trim() };
    const b: Measure | undefined = bKind && bValue.trim() ? { kind: bKind, value: bValue.trim() } : undefined;
    onSave([...ratios, { id: `r-${Date.now().toString(36)}`, a, ...(b ? { b } : {}) }]);
    reset();
  };

  return (
    <section aria-label="Ratios" className="space-y-1.5">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Ratios</h3>
      {ratios.length === 0 && !adding && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Compare two parts of your deck, like discard vs Gate or red vs blue.
        </p>
      )}
      <ul>
        {ratios.map(r => {
          const row = ratioRow(r, deck);
          const on = r.id === activeId;
          return (
            <li key={r.id} className={`flex items-center border-b border-gray-200 dark:border-gray-800 ${on ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800/70"}`}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Compare ${row.label}: ${row.value}`}
                onClick={() => onCompare(r)}
                className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-2 px-1 py-1.5 text-left"
              >
                <span className="truncate">{row.label}</span>
                <span className="tabular-nums">{row.value}{row.note && <> <span className="text-xs text-gray-500 dark:text-gray-400">({row.note})</span></>}</span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ratio ${row.label}`}
                  onClick={() => onSave(ratios.filter(x => x.id !== r.id))}
                  className="w-7 self-stretch text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <X className="mx-auto h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="text-sm text-blue-700 underline hover:no-underline dark:text-blue-400">
          + Add ratio
        </button>
      )}
      {canEdit && adding && (
        <form
          onSubmit={e => { e.preventDefault(); save(); }}
          className="space-y-2 border border-gray-300 p-2 dark:border-gray-700"
        >
          <MeasureFields which="First" kind={aKind} value={aValue} onKind={k => { setAKind(k as MeasureKind); setAValue(defaultValue(k as MeasureKind)); }} onValue={setAValue} />
          <div className="text-xs text-gray-600 dark:text-gray-400">compared with</div>
          <MeasureFields which="Second" kind={bKind} value={bValue} allowNone onKind={k => { setBKind(k); setBValue(k ? defaultValue(k) : ""); }} onValue={setBValue} />
          <div className="flex gap-2 pt-1">
            <button type="submit" className="rounded-sm border border-gray-400 bg-gray-100 px-2.5 py-1 text-sm hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">Save ratio</button>
            <button type="button" onClick={reset} className="text-sm text-blue-700 underline hover:no-underline dark:text-blue-400">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

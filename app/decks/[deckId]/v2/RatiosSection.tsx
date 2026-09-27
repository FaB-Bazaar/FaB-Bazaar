"use client";

// Stats panel "Ratios": the deck's saved A : B comparisons (decks.metadata.ratios).
// Click a row to compare both sides side by side above the deck; editors can add
// (plain inline form) and remove. Traditional table look, no animation.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { KIND_NAME, measureLabel, measureSuggestions, ratioRow, type DeckRatio, type Measure } from "@/lib/deck/ratios";

const FIELD = "rounded-sm border border-gray-400 bg-white px-1.5 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900";

/** One side of a ratio: type a word, pick what it means from suggestions
 *  (card type / keyword / pitch the deck has, then card text), each with its
 *  count — so "Item" is the type, not text that mentions items. */
function MeasurePicker({ which, deck, value, onChange, optional }: {
  which: "First" | "Second";
  deck: DeckDTO;
  value: Measure | null;
  onChange: (m: Measure | null) => void;
  optional?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const suggestions = useMemo(() => measureSuggestions(query, deck), [query, deck]);
  const listId = `${which.toLowerCase()}-measure-options`;

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>{measureLabel(value)} ({KIND_NAME[value.kind]})</span>
        <button type="button" onClick={() => { onChange(null); setQuery(""); }} className="text-blue-700 underline hover:no-underline dark:text-blue-400">Change</button>
      </div>
    );
  }

  const pick = (i: number) => { const s = suggestions[i]; if (s) { onChange(s.measure); setQuery(""); } };
  return (
    <div>
      <input
        role="combobox"
        aria-label={`${which} measure`}
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={e => { setQuery(e.target.value); setHighlight(0); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(highlight); }
        }}
        placeholder={optional ? "e.g. item — or leave empty for a share" : "e.g. boost, item, blue"}
        autoComplete="off"
        className={`${FIELD} w-full`}
      />
      {suggestions.length > 0 && (
        <ul id={listId} role="listbox" aria-label={`${which} measure suggestions`} className="mt-1 border border-gray-300 dark:border-gray-700">
          {suggestions.map((s, i) => (
            <li
              key={`${s.measure.kind}:${s.measure.value}`}
              role="option"
              aria-selected={i === highlight}
              aria-label={`${s.label} · ${s.kindName} · ${s.count}`}
              onMouseDown={e => { e.preventDefault(); pick(i); }}
              onMouseEnter={() => setHighlight(i)}
              className={`grid cursor-pointer grid-cols-[1fr_auto_2.5rem] gap-2 border-b border-gray-200 px-1.5 py-1 text-sm last:border-b-0 dark:border-gray-800 ${i === highlight ? "bg-gray-200 dark:bg-gray-800" : ""}`}
            >
              <span className="truncate">{s.label}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{s.kindName}</span>
              <span className="text-right tabular-nums">{s.count}</span>
            </li>
          ))}
        </ul>
      )}
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
  const [a, setA] = useState<Measure | null>(null);
  const [b, setB] = useState<Measure | null>(null);

  const reset = () => { setAdding(false); setA(null); setB(null); };
  const save = () => {
    if (!a) return;
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
          <MeasurePicker which="First" deck={deck} value={a} onChange={setA} />
          <div className="text-xs text-gray-600 dark:text-gray-400">compared with</div>
          <MeasurePicker which="Second" deck={deck} value={b} onChange={setB} optional />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!a} className="rounded-sm border border-gray-400 bg-gray-100 px-2.5 py-1 text-sm hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">Save ratio</button>
            <button type="button" onClick={reset} className="text-sm text-blue-700 underline hover:no-underline dark:text-blue-400">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

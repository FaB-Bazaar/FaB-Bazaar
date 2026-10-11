// components/scan/NameAutocomplete.tsx — type a few letters of a card's name, pick from suggestions. Suggestions come
// from the card-name list the scanner already has in memory (lib/scan/banner/name-match suggestNames): instant, no
// server round-trip. ARIA combobox pattern: ArrowUp/Down move, Enter picks (the highlighted suggestion, else what was
// typed — the page resolves it with the fuzzy matcher), Escape closes; tap/click picks.
"use client";

import { useId, useMemo, useState } from "react";
import { suggestNames, matchName, type NameIndex } from "@/lib/scan/banner/name-match";
import { orderPrintings } from "@/lib/scan/banner/printing-options";
import PrintingChoice from "@/components/scan/PrintingChoice";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const PITCH = { 1: "red", 2: "yellow", 3: "blue" } as Record<number, string>;
const PITCH_DOT = { 1: "bg-red-600", 2: "bg-yellow-400", 3: "bg-blue-600" } as Record<number, string>;

interface Props {
  index: NameIndex | null;
  label: string;
  submitLabel: string;
  placeholder?: string;
  /** printing = the one the user picked from the text list; null = "use the usual one". printings = all of them. */
  onPick: (name: string, printing?: any | null, printings?: any[]) => void;
  /** when given, picking a name shows its printings as text lines to choose from first */
  loadPrintings?: (name: string) => Promise<any[]>;
}

export default function NameAutocomplete({ index, label, submitLabel, placeholder = "Start typing the card's name", onPick, loadPrintings }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [chosen, setChosen] = useState<{ name: string; printings: any[] | null } | null>(null);
  const suggestions = useMemo(() => (index ? suggestNames(index, value) : []), [index, value]);
  const showList = open && suggestions.length > 0;

  const pick = (typed: string) => {
    if (!typed.trim()) return;
    // a typed name that isn't a suggestion is resolved to the closest card (typos, missing punctuation)
    const name = suggestions.find(s => s.name.toLowerCase() === typed.trim().toLowerCase())?.name
      ?? (index ? matchName(index, typed).card : "") ?? typed.trim();
    const finalName = name || typed.trim();
    setValue(""); setOpen(false); setActive(-1);
    if (!loadPrintings) { onPick(finalName); return; }
    setChosen({ name: finalName, printings: null });
    void loadPrintings(finalName).then(ps => setChosen(c => (c && c.name === finalName ? { name: finalName, printings: orderPrintings(ps) } : c)));
  };

  if (chosen) {
    const done = (printing: any | null) => { onPick(chosen.name, printing, chosen.printings ?? undefined); setChosen(null); };
    return <PrintingChoice name={chosen.name} printings={chosen.printings} onChoose={done}
      primary={{ label: "Use the usual one", onClick: () => done(null) }} cancelLabel="Back" onCancel={() => setChosen(null)} />;
  }

  return (
    <form className="relative flex w-full flex-wrap gap-1.5" onSubmit={e => { e.preventDefault(); pick(active >= 0 ? suggestions[active].name : value); }}>
      <label className="sr-only" htmlFor={`${id}-input`}>{label}</label>
      <input id={`${id}-input`} role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        value={value} placeholder={placeholder} autoFocus autoComplete="off"
        onChange={e => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === "ArrowDown" && suggestions.length) { e.preventDefault(); setOpen(true); setActive(a => Math.min(suggestions.length - 1, a + 1)); }
          else if (e.key === "ArrowUp" && suggestions.length) { e.preventDefault(); setActive(a => Math.max(-1, a - 1)); }
          else if (e.key === "Escape") { setOpen(false); setActive(-1); }
        }}
        className={`min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${FOCUS_RING}`} />
      <button type="submit" className={`rounded-md bg-gray-900 px-3 py-1.5 text-base font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 ${FOCUS_RING}`}>{submitLabel}</button>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label={`${label}: suggestions`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {suggestions.map((s, i) => (
            <li key={s.name} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              // mousedown, not click: keeps focus in the input so the list doesn't close before the pick lands
              onMouseDown={e => { e.preventDefault(); pick(s.name); }}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-base text-gray-900 dark:text-gray-100 ${i === active ? "bg-blue-100 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
              <span>{s.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.pitches.filter((p): p is number => p !== null).map(p => <span key={p} className={`inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[p]}`} aria-hidden />)}
                <span className="sr-only">{s.pitches.some(p => p !== null) ? s.pitches.filter((p): p is number => p !== null).map(p => PITCH[p]).join(", ") : "no pitch"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

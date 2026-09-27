"use client";

// "Find in deck" flyout: the Cmd+K highlights (card text, type, keyword) as
// clickable rows with live counts. Clicking a row drives the SAME
// `deck-highlight-filter` event the classic page's chords dispatch, so
// DeckEditorListView highlights without knowing about v2.

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { X } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import type { Lens } from "@/lib/deck/deck-table";
import { brewFacetRows, type BrewFacets } from "@/lib/deck/brew";
import { resolveHeroFilter } from "@/lib/deck/resolve-hero-filter";
import { countTextMatches, formatRatio, keywordTally, playableCount, typeTally } from "@/lib/deck/deck-lens";

export type Active = Lens | null;

const SUGGESTIONS = ["discard", "draw", "banish", "create", "destroy", "graveyard", "search your deck"];

const lensKey = (deckId: string) => `deckV2Lenses:${deckId}`;

function readLenses(deckId: string): string[] {
  try {
    const raw = localStorage.getItem(lensKey(deckId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function writeLenses(deckId: string, lenses: string[]) {
  try { localStorage.setItem(lensKey(deckId), JSON.stringify(lenses)); } catch { /* per-viewer convenience only */ }
}

function highlight(stat: string, value: string) {
  window.dispatchEvent(new CustomEvent("deck-highlight-clear"));
  window.dispatchEvent(new CustomEvent("deck-highlight-filter", { detail: { stat, value } }));
}

function clearHighlight() {
  window.dispatchEvent(new CustomEvent("deck-highlight-clear"));
}

// `active` lives on the page so the Table view can lift matches, and so the
// highlight survives switching panels.
export default function FindPanel({ deck, deckId, active, setActive, brewing = false, facets = {}, setFacets, onSaveRatio }: {
  deck: DeckDTO;
  deckId: string;
  active: Active;
  setActive: Dispatch<SetStateAction<Active>>;
  /** Brew tab: the same rows filter the legal pool instead of highlighting the deck. */
  brewing?: boolean;
  /** Brew-only Class / Talent / Rarity picks (one per section, ANDed). */
  facets?: BrewFacets;
  setFacets?: Dispatch<SetStateAction<BrewFacets>>;
  /** Editors: save the first two pinned words as a deck ratio (Stats → Ratios). */
  onSaveRatio?: (a: string, b: string) => void;
}) {
  const [lenses, setLenses] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => { setLenses(readLenses(deckId)); }, [deckId]);

  // The list view clears its highlight on Escape without telling anyone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const total = playableCount(deck);
  const lensCounts = useMemo(() => lenses.map(term => ({ term, ...countTextMatches(deck, term) })), [deck, lenses]);
  const types = useMemo(() => typeTally(deck), [deck]);
  const keywords = useMemo(() => keywordTally(deck), [deck]);

  const saveLenses = (next: string[]) => { setLenses(next); writeLenses(deckId, next); };
  const addLens = (raw: string) => {
    const term = raw.trim();
    if (!term) return;
    if (!lenses.some(l => l.toLowerCase() === term.toLowerCase())) saveLenses([...lenses, term]);
    setDraft("");
    show("text", term);
  };
  const removeLens = (term: string) => {
    saveLenses(lenses.filter(l => l !== term));
    if (active?.stat === "text" && active.value === term) { clearHighlight(); setActive(null); }
  };
  const show = (stat: NonNullable<Active>["stat"], value: string) => {
    highlight(stat, value);
    setActive({ stat, value });
  };
  const toggle = (stat: NonNullable<Active>["stat"], value: string) => {
    if (active?.stat === stat && active.value === value) { clearHighlight(); setActive(null); return; }
    show(stat, value);
  };

  // Live search: typing highlights as you go (Enter pins the word to the list).
  // Emptying the box drops a live highlight, but never a pinned row's.
  const liveTerm = draft.trim();
  const live = useMemo(() => (liveTerm ? countTextMatches(deck, liveTerm) : null), [deck, liveTerm]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (liveTerm) { highlight("text", liveTerm); setActive({ stat: "text", value: liveTerm }); return; }
      setActive(prev => {
        if (prev?.stat === "text" && !lenses.includes(prev.value)) { clearHighlight(); return null; }
        return prev;
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on typing only; `lenses` is read fresh
  }, [liveTerm]);
  const isActive = (stat: string, value: string) => active?.stat === stat && active.value === value;

  const ratio = lensCounts.length >= 2 ? formatRatio(lensCounts[0].copies, lensCounts[1].copies) : null;

  const clear = () => { clearHighlight(); setActive(null); setFacets?.({}); };
  const hasFacets = brewing && Object.values(facets).some(Boolean);
  const heroKey = JSON.stringify(resolveHeroFilter(deck));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hero keyed by content
  const facetRows = useMemo(() => brewFacetRows(deck, resolveHeroFilter(deck)), [deck, heroKey]);
  const pickFacet = (section: keyof BrewFacets, value: string) =>
    setFacets?.(prev => ({ ...prev, [section]: prev[section] === value ? undefined : value }));
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-5 text-sm text-gray-800 dark:text-gray-200">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{brewing ? "Find cards to add" : "Find in deck"}</h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {brewing
            ? <>Click a row to show legal cards you don&rsquo;t play yet. Numbers are what your deck already has ({total} cards).</>
            : <>Counts cover your main deck, equipment and inventory ({total} cards). Click a row to highlight those cards.</>}
          {(active || hasFacets) && (
            <> <button type="button" onClick={clear} className="text-blue-700 underline hover:no-underline dark:text-blue-400">{brewing ? "Clear filters" : "Clear highlight"}</button></>
          )}
        </p>
      </div>

      <section aria-labelledby="find-text-heading">
        <h3 id="find-text-heading" className={SECTION_HEADING}>Card text</h3>
        <form onSubmit={e => { e.preventDefault(); addLens(draft); }}>
          <label htmlFor="find-text-input" className="sr-only">Find cards whose text mentions</label>
          <input
            id="find-text-input"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. discard"
            className="w-full rounded-sm border border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:outline-none dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          />
        </form>
        {live && (
          <p data-testid="live-count" aria-live="polite" className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {live.copies === 0
              ? <>No cards mention &ldquo;{liveTerm}&rdquo;.</>
              : <><strong className="text-gray-900 dark:text-gray-100">{live.copies} {live.copies === 1 ? "copy" : "copies"}</strong> in {live.cards} different {live.cards === 1 ? "card" : "cards"}. Press Enter to add it to the list.</>}
          </p>
        )}

        {lensCounts.length === 0 ? (liveTerm ? null : (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Try:{" "}
            {SUGGESTIONS.map((s, i) => (
              <span key={s}>
                {i > 0 && ", "}
                <button type="button" onClick={() => addLens(s)} className="text-blue-700 underline hover:no-underline dark:text-blue-400">{s}</button>
              </span>
            ))}
          </p>
        )
        ) : (
          <div className="mt-2 text-sm">
            <div className={`${LENS_GRID} border-b border-gray-300 py-1 pl-1 pr-8 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-400`} aria-hidden>
              <span>Text</span><span className="text-right">Copies</span><span className="text-right">Cards</span><span className="text-right">%</span>
            </div>
            <ul>
              {lensCounts.map(({ term, copies, cards }) => {
                const on = isActive("text", term);
                return (
                  <li key={term} className={`flex items-center border-b border-gray-200 dark:border-gray-800 ${on ? ROW_ON : ROW_HOVER}`}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`Highlight "${term}": ${copies} ${copies === 1 ? "copy" : "copies"}, ${cards} different ${cards === 1 ? "card" : "cards"}`}
                      onClick={() => toggle("text", term)}
                      className={`${LENS_GRID} ${ROW_BUTTON} flex-1`}
                    >
                      <span className="truncate">{term}</span>
                      <span className="text-right tabular-nums">{copies}</span>
                      <span className="text-right tabular-nums">{cards}</span>
                      <span className="text-right tabular-nums">{pct(copies)}</span>
                    </button>
                    <button type="button" aria-label={`Remove "${term}"`} onClick={() => removeLens(term)} className="w-7 self-stretch text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
                      <X className="mx-auto h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {lensCounts.length >= 2 && (
          <p data-testid="lens-ratio" className="mt-2">
            Ratio of {lensCounts[0].term} to {lensCounts[1].term}:{" "}
            <strong className="tabular-nums">{lensCounts[0].copies} to {lensCounts[1].copies}</strong>
            {ratio && <span className="text-gray-600 dark:text-gray-400"> ({ratio})</span>}
            {onSaveRatio && (
              <>
                {" "}
                <button type="button" onClick={() => onSaveRatio(lensCounts[0].term, lensCounts[1].term)} className="text-blue-700 underline hover:no-underline dark:text-blue-400">
                  Save as ratio
                </button>
              </>
            )}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Any card whose text contains the words counts, so &ldquo;discard&rdquo; also matches &ldquo;your opponent discards&rdquo;.
        </p>
      </section>

      {brewing && (
        <>
          <TallyTable
            title="Class"
            filterName="Class"
            rows={facetRows.classes.map(r => ({ key: r.value, label: r.label, copies: r.copies }))}
            isActive={v => facets.class === v}
            onPick={v => pickFacet("class", v)}
          />
          {facetRows.talents.length > 0 && (
            <TallyTable
              title="Talent"
              filterName="Talent"
              rows={facetRows.talents.map(r => ({ key: r.value, label: r.label, copies: r.copies }))}
              isActive={v => facets.talent === v}
              onPick={v => pickFacet("talent", v)}
            />
          )}
          <TallyTable
            title="Rarity"
            filterName="Rarity"
            rows={facetRows.rarities.map(r => ({ key: r.value, label: r.label, copies: r.copies }))}
            isActive={v => facets.rarity === v}
            onPick={v => pickFacet("rarity", v)}
          />
        </>
      )}

      <TallyTable
        title="Card types"
        rows={types.map(t => ({ key: t.value, label: t.label, copies: t.copies }))}
        isActive={v => isActive("type", v)}
        onPick={v => toggle("type", v)}
      />

      {keywords.length > 0 && (
        <TallyTable
          title="Keywords"
          rows={keywords.map(k => ({ key: k.keyword.toLowerCase(), label: k.keyword, copies: k.copies }))}
          isActive={v => isActive("keyword", v)}
          onPick={v => toggle("keyword", v)}
        />
      )}
    </div>
  );
}

const SECTION_HEADING = "mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300";
const ROW_ON = "bg-amber-100 dark:bg-amber-900/30";
const ROW_HOVER = "hover:bg-gray-100 dark:hover:bg-gray-800/70";
// The whole row is the button — clicking anywhere on it toggles the highlight.
const ROW_BUTTON = "w-full cursor-pointer px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500";
const LENS_GRID = "grid grid-cols-[1fr_3.5rem_3rem_2.5rem] gap-2";

function TallyTable({ title, rows, isActive, onPick, filterName }: {
  title: string;
  /** Brew facet sections name the filter ("Rarity Legendary: …") so a rarity row
   *  never shares a name with a keyword row ("Highlight Legendary: …"). */
  filterName?: string;
  rows: Array<{ key: string; label: string; copies: number }>;
  isActive: (value: string) => boolean;
  onPick: (value: string) => void;
}) {
  return (
    <section>
      <h3 className={SECTION_HEADING}>{title}</h3>
      <ul className="text-sm">
        {rows.map(r => {
          const on = isActive(r.key);
          return (
            <li key={r.key} className={`border-b border-gray-200 dark:border-gray-800 ${on ? ROW_ON : ROW_HOVER}`}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${filterName ?? "Highlight"} ${r.label}: ${r.copies} ${r.copies === 1 ? "copy" : "copies"}`}
                onClick={() => onPick(r.key)}
                className={`grid grid-cols-[1fr_auto] gap-2 ${ROW_BUTTON}`}
              >
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums">{r.copies}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

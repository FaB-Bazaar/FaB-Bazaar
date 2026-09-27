"use client";

// Deck v2 "Brew" tab: every card legal for this deck (hero + format — the same
// legality the Add Card dialog bakes in) that isn't in the deck yet, narrowed by
// the Find panel's active lens and Class / Talent / Rarity picks.
//
// Adding (editors only): hover or focus a tile for a "+" that puts one copy on
// the Bench (QUICK_ZONE); 9 / 8 / 7 on a focused tile add to main deck /
// inventory / bench; clicking the tile opens a details panel with copies and
// zone buttons. The quick-add printing is the search's representative printing
// (card.printings[0]) — the same default the Add Card dialog uses. Cards added
// here stay on screen with a "Bench ×1" badge + undo until the filters change.
// No transitions or animations, on purpose.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import type { DeckCategory, DeckDTO } from "@/lib/services/contracts/IDeckService";
import { useCardSearch } from "@/hooks/search/useCardSearch";
import { buildDeckAddFilters } from "@/lib/search/deck-add-filters";
import { DEFAULT_OPT_STATE } from "@/lib/search/opt-url-state";
import { resolveHeroFilter } from "@/lib/deck/resolve-hero-filter";
import { groupSearchPrintingsToCards, type CardResultWithCount } from "@/lib/deck/group-search-results";
import {
  deckCopiesByZone, facetsLabel, facetsToSearchFilters, lensToSearchFilters, notInDeck, pitchSiblings, type BrewFacets,
} from "@/lib/deck/brew";
import { lensLabel } from "@/lib/deck/deck-lens";
import type { Lens } from "@/lib/deck/deck-table";
import { RulesText } from "@/components/cards/CardDetailsLightbox";

/** id of the page's right-hand column the details panel renders into. */
export const BREW_DETAILS_SLOT = "brew-details-slot";

/** Where the tile "+" puts a card. Brewing is trying ideas — the Bench never
 *  disturbs the deck's count or legality. */
const QUICK_ZONE: DeckCategory = "benched";

const ZONE_LABEL: Partial<Record<DeckCategory, string>> = {
  hero: "Hero", equipment: "Equipment", maindeck: "Main deck", inventory: "Inventory", benched: "Bench",
};
const KEY_ZONE: Record<string, DeckCategory> = { "9": "maindeck", "8": "inventory", "7": "benched" };
const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };
const PITCH_NAME: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };

type Card = CardResultWithCount;
const cardLabel = (c: Card) => (c.pitch && PITCH_NAME[c.pitch] ? `${c.name} (${PITCH_NAME[c.pitch]})` : c.name);
const printingOf = (c: Card) => c.printings[0] as any;

export default function BrewView({ deck, active, facets, canEdit, onAdd, onRemoveOne }: {
  deck: DeckDTO;
  active: Lens | null;
  facets: BrewFacets;
  canEdit: boolean;
  /** Add copies of a printing to a zone; resolves once the deck has refreshed. */
  onAdd: (printingId: string, zone: DeckCategory, quantity: number) => Promise<void>;
  onRemoveOne: (printingId: string, zone: DeckCategory) => Promise<void>;
}) {
  // Keyed on the resolved content, not the deck object — every deck refresh is
  // a new object and would otherwise re-run the search (see MobileCardSearch).
  const hero = resolveHeroFilter(deck);
  const heroKey = JSON.stringify(hero);
  const filters = useMemo(
    () => ({
      ...buildDeckAddFilters(DEFAULT_OPT_STATE, "", { hero, deckFormat: deck.format, targetCategory: "maindeck" }),
      ...lensToSearchFilters(active),
      ...facetsToSearchFilters(facets),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hero is keyed by content
    [heroKey, deck.format, active, facets],
  );
  const hasLegality = Object.keys(filters).length > 0;

  const search = useCardSearch({
    filters,
    languages: ["en"],
    sortBy: "name",
    sortOrder: "asc",
    groupByCard: true,
    enabled: hasLegality,
  });

  // Cards added during this view stay visible (badge + undo) until the filters change.
  const [kept, setKept] = useState<Set<string>>(new Set());
  const filtersKey = JSON.stringify(filters);
  useEffect(() => { setKept(new Set()); }, [filtersKey]);

  const allLoaded = useMemo(() => groupSearchPrintingsToCards(search.results as any), [search.results]);
  const cards = useMemo(() => notInDeck(allLoaded, deck, kept), [allLoaded, deck, kept]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The details panel lives in the page's full-height right column (so its add
  // buttons sit near the top of the window, not below the card grid's header).
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById(BREW_DETAILS_SLOT)); }, []);
  const selected = allLoaded.find(c => c.unique_id === selectedId) ?? null;

  const add = async (card: Card, zone: DeckCategory, quantity = 1) => {
    const printing = printingOf(card);
    if (!printing?.printing_id) return;
    setKept(prev => new Set(prev).add(card.unique_id));
    await onAdd(printing.printing_id, zone, quantity);
  };

  const picked = [active && lensLabel(active), facetsLabel(facets)].filter(Boolean).join(" · ");
  const label = `Legal cards not in your deck${picked ? ` — ${picked}` : ""}`;

  return (
    <>
      <section aria-label={label} className="border border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <span>{label}</span>
          {/* The previous pool stays up while a new filter loads — say so, and dim it. */}
          {search.loading && cards.length > 0 && (
            <span role="status" className="font-normal text-gray-600 dark:text-gray-400">Updating…</span>
          )}
        </div>

        {!hasLegality ? (
          <p className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">Set a hero or format for this deck to see its legal cards.</p>
        ) : search.error ? (
          <p className="px-3 py-3 text-sm text-red-700 dark:text-red-400">Couldn&rsquo;t load cards: {search.error}</p>
        ) : search.loading && cards.length === 0 ? (
          <p className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">Loading legal cards…</p>
        ) : cards.length === 0 ? (
          <p className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">No legal cards left to add{active ? " for this filter" : ""}.</p>
        ) : (
          <>
            {canEdit && (
              <p className="px-3 pt-2 text-xs text-gray-600 dark:text-gray-400">
                Hover a card and press <strong>+</strong> to put it on the Bench, or click it for details. With a card focused, 9 / 8 / 7 add to main deck / inventory / bench.
              </p>
            )}
            <ul className={`flex flex-wrap gap-3 p-3 ${search.loading ? "opacity-40" : ""}`} aria-busy={search.loading}>
              {cards.map(c => (
                <BrewTile
                  key={c.unique_id}
                  card={c}
                  inDeck={deckCopiesByZone(deck, c.unique_id)}
                  selected={c.unique_id === selectedId}
                  canEdit={canEdit}
                  onOpen={() => setSelectedId(c.unique_id)}
                  onAdd={zone => add(c, zone)}
                  onUndo={(printingId, zone) => onRemoveOne(printingId, zone)}
                />
              ))}
            </ul>
            {/* infinite scroll: the hook loads the next page when this comes into view */}
            <div ref={search.sentinelRef} className="h-8" aria-hidden />
            {search.loadingMore && <p className="px-3 pb-3 text-xs text-gray-600 dark:text-gray-400">Loading more…</p>}
          </>
        )}
      </section>

      {selected && slot && createPortal(
        <BrewDetails
          card={selected}
          siblings={pitchSiblings(allLoaded, selected)}
          inDeck={deckCopiesByZone(deck, selected.unique_id)}
          canEdit={canEdit}
          onPick={id => setSelectedId(id)}
          onClose={() => setSelectedId(null)}
          onAdd={(zone, qty) => add(selected, zone, qty)}
        />,
        slot,
      )}
    </>
  );
}

function BrewTile({ card, inDeck, selected, canEdit, onOpen, onAdd, onUndo }: {
  card: Card;
  inDeck: ReturnType<typeof deckCopiesByZone>;
  selected: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onAdd: (zone: DeckCategory) => void;
  onUndo: (printingId: string, zone: DeckCategory) => void;
}) {
  const name = cardLabel(card);
  return (
    <li className="group relative w-[120px]">
      <button
        type="button"
        aria-label={`Show details for ${name}`}
        onClick={onOpen}
        onKeyDown={e => {
          if (!canEdit || e.metaKey || e.ctrlKey || e.altKey || !KEY_ZONE[e.key]) return;
          e.preventDefault();
          onAdd(KEY_ZONE[e.key]);
        }}
        className={`block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? "ring-2 ring-blue-600" : ""}`}
      >
        <img src={printingOf(card)?.image_url || "/cardback.webp"} alt="" loading="lazy" className="w-full rounded-md" />
      </button>
      {canEdit && (
        <button
          type="button"
          aria-label={`Add ${name} to ${ZONE_LABEL[QUICK_ZONE]}`}
          title={`Add to ${ZONE_LABEL[QUICK_ZONE]}`}
          onClick={() => onAdd(QUICK_ZONE)}
          className="invisible absolute right-1 top-1 rounded-sm border border-gray-300 bg-white p-0.5 text-gray-900 hover:bg-gray-100 group-hover:visible group-focus-within:visible dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200" title={card.name}>
        {card.pitch != null && PITCH_DOT[card.pitch] && (
          <span role="img" aria-label={`Pitch ${card.pitch}`} className={`h-2 w-2 flex-shrink-0 rounded-full ${PITCH_DOT[card.pitch]}`} />
        )}
        <span className="truncate">{card.name}</span>
      </p>
      {inDeck.map(z => (
        <p key={z.zone} className="mt-0.5 flex items-center justify-between text-[11px] font-semibold text-gray-900 dark:text-gray-100">
          <span>{ZONE_LABEL[z.zone]} ×{z.qty}</span>
          {canEdit && (
            <button
              type="button"
              aria-label={`Remove a copy of ${name} from ${ZONE_LABEL[z.zone]}`}
              title="Remove a copy"
              onClick={() => onUndo(z.printingId, z.zone)}
              className="rounded-sm border border-gray-300 px-0.5 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Minus className="h-3 w-3" aria-hidden />
            </button>
          )}
        </p>
      ))}
    </li>
  );
}

function BrewDetails({ card, siblings, inDeck, canEdit, onPick, onClose, onAdd }: {
  card: Card;
  siblings: Card[];
  inDeck: ReturnType<typeof deckCopiesByZone>;
  canEdit: boolean;
  onPick: (uniqueId: string) => void;
  onClose: () => void;
  onAdd: (zone: DeckCategory, quantity: number) => void;
}) {
  const [copies, setCopies] = useState(1);
  useEffect(() => { setCopies(1); }, [card.unique_id]);
  const p = printingOf(card);
  const stats = [
    p?.cost != null && `Cost ${p.cost}`,
    p?.power != null && `Power ${p.power}`,
    p?.defense != null && `Defense ${p.defense}`,
  ].filter(Boolean).join(" · ");

  return (
    <aside aria-label="Card details" className="text-sm text-gray-800 dark:text-gray-200">
      <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{card.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-sm p-0.5 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="space-y-3 p-3">
        {siblings.length > 1 && (
          <div role="group" aria-label="Pitch" className="flex gap-1">
            {siblings.map(s => (
              <button
                key={s.unique_id}
                type="button"
                aria-pressed={s.unique_id === card.unique_id}
                onClick={() => onPick(s.unique_id)}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs ${s.unique_id === card.unique_id ? "border-gray-500 bg-gray-200 font-semibold dark:bg-gray-800" : "border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"}`}
              >
                {s.pitch != null && <span className={`h-2 w-2 rounded-full ${PITCH_DOT[s.pitch] ?? "bg-gray-400"}`} aria-hidden />}
                {s.pitch != null ? PITCH_NAME[s.pitch] ?? s.pitch : "—"}
              </button>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="space-y-2 border-b border-gray-200 pb-3 dark:border-gray-800">
            <label className="flex items-center gap-2 text-xs">
              Copies
              <select
                value={copies}
                onChange={e => setCopies(Number(e.target.value))}
                className="rounded-sm border border-gray-400 bg-white px-1 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="text-xs text-gray-600 dark:text-gray-400">Add to</div>
            <div className="flex flex-wrap gap-1.5">
              {(["maindeck", "inventory", "benched"] as const).map(zone => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => onAdd(zone, copies)}
                  className="rounded-sm border border-gray-400 bg-gray-100 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  {ZONE_LABEL[zone]}
                </button>
              ))}
            </div>
          </div>
        )}
        {inDeck.length > 0 && (
          <p className="text-xs">In this deck: {inDeck.map(z => `${ZONE_LABEL[z.zone]} ×${z.qty}`).join(", ")}</p>
        )}
        <img src={p?.image_url || "/cardback.webp"} alt={cardLabel(card)} className="w-full rounded-md" />
        {p?.type_text_display && <p className="text-xs text-gray-600 dark:text-gray-400">{p.type_text_display}{stats && ` · ${stats}`}</p>}
        {p?.text && <RulesText text={p.text} className="text-gray-800 dark:text-gray-200" />}
      </div>
    </aside>
  );
}

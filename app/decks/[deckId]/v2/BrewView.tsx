"use client";

// Deck v2 "Brew" tab: every card legal for this deck (hero + format — the same
// legality the Add Card dialog bakes in) that isn't in the deck yet, narrowed by
// the Find panel's active lens. Tiles only for now: no add buttons.

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { useCardSearch } from "@/hooks/search/useCardSearch";
import { buildDeckAddFilters } from "@/lib/search/deck-add-filters";
import { DEFAULT_OPT_STATE } from "@/lib/search/opt-url-state";
import { resolveHeroFilter } from "@/lib/deck/resolve-hero-filter";
import { groupSearchPrintingsToCards } from "@/lib/deck/group-search-results";
import { lensToSearchFilters, notInDeck } from "@/lib/deck/brew";
import { lensLabel } from "@/lib/deck/deck-lens";
import type { Lens } from "@/lib/deck/deck-table";

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };

export default function BrewView({ deck, active }: { deck: DeckDTO; active: Lens | null }) {
  // Keyed on the resolved content, not the deck object — every deck refresh is
  // a new object and would otherwise re-run the search (see MobileCardSearch).
  const hero = resolveHeroFilter(deck);
  const heroKey = JSON.stringify(hero);
  const filters = useMemo(
    () => ({
      ...buildDeckAddFilters(DEFAULT_OPT_STATE, "", { hero, deckFormat: deck.format, targetCategory: "maindeck" }),
      ...lensToSearchFilters(active),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hero is keyed by content
    [heroKey, deck.format, active],
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

  const cards = useMemo(() => notInDeck(groupSearchPrintingsToCards(search.results as any), deck), [search.results, deck]);
  const label = `Legal cards not in your deck${active ? ` — ${lensLabel(active)}` : ""}`;

  return (
    <section aria-label={label} className="border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        <span>{label}</span>
        {/* The previous pool stays up while a new filter loads — say so, and dim it. */}
        {search.loading && cards.length > 0 && (
          <span role="status" className="flex items-center gap-1.5 font-normal text-gray-600 dark:text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating…
          </span>
        )}
      </div>

      {!hasLegality ? (
        <p className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">Set a hero or format for this deck to see its legal cards.</p>
      ) : search.error ? (
        <p className="px-3 py-3 text-sm text-red-700 dark:text-red-400">Couldn&rsquo;t load cards: {search.error}</p>
      ) : search.loading && cards.length === 0 ? (
        <p className="flex items-center gap-2 px-3 py-3 text-sm text-gray-600 dark:text-gray-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading legal cards…</p>
      ) : cards.length === 0 ? (
        <p className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">No legal cards left to add{active ? " for this filter" : ""}.</p>
      ) : (
        <>
          <ul className={`flex flex-wrap gap-3 p-3 transition-opacity ${search.loading ? "opacity-40" : ""}`} aria-busy={search.loading}>
            {cards.map(c => {
              const img = (c.printings[0] as any)?.image_url as string | undefined;
              return (
                <li key={c.unique_id} className="w-[120px]">
                  <img src={img || "/cardback.webp"} alt={c.name} loading="lazy" className="w-full rounded-md" />
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200" title={c.name}>
                    {c.pitch != null && PITCH_DOT[c.pitch] && (
                      <span role="img" aria-label={`Pitch ${c.pitch}`} className={`h-2 w-2 flex-shrink-0 rounded-full ${PITCH_DOT[c.pitch]}`} />
                    )}
                    <span className="truncate">{c.name}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          {/* infinite scroll: the hook loads the next page when this comes into view */}
          <div ref={search.sentinelRef} className="h-8" aria-hidden />
          {search.loadingMore && <p className="px-3 pb-3 text-xs text-gray-600 dark:text-gray-400">Loading more…</p>}
        </>
      )}
    </section>
  );
}

"use client";

// Side-by-side view of a ratio's two sides, above the deck: the cards counted
// on each side (main deck + equipment + inventory, as the counts), as tiles in
// the Cards view or as lists in the Table view. A single-measure ratio shows
// one column. Plain, no animation.

import { useMemo, useState } from "react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { buildDeckTableRows, type DeckTableRow } from "@/lib/deck/deck-table";
import { measureLabel, measureMatches, ratioRow, type DeckRatio, type Measure } from "@/lib/deck/ratios";
import { handOdds, librarySplit, type HandCondition, type MatchupSwaps } from "@/lib/deck/hand-odds";
import { matchupDisplayName } from "@/lib/deck/matchup-names";

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };
const ZONE: Record<string, string> = { maindeck: "Main deck", equipment: "Equipment", inventory: "Inventory" };

function Side({ measure, rows, style }: { measure: Measure; rows: DeckTableRow[]; style: "tiles" | "list" }) {
  const copies = rows.reduce((n, r) => n + r.qty, 0);
  const label = `${measureLabel(measure)} · ${copies} ${copies === 1 ? "copy" : "copies"}`;
  return (
    <div role="group" aria-label={label} className="min-w-0 flex-1 border border-gray-300 dark:border-gray-700">
      <h3 className="border-b border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{label}</h3>
      {rows.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">No cards.</p>
      ) : style === "tiles" ? (
        <ul className="flex flex-wrap gap-2 p-2">
          {rows.map(r => (
            <li key={r.key} className="w-[96px]">
              <div className="relative">
                <img src={r.details.image_url || "/cardback.webp"} alt={r.name} loading="lazy" className="w-full rounded-md" />
                <span className="absolute right-1 top-1 rounded-sm bg-black/75 px-1 text-[11px] font-semibold tabular-nums text-white">×{r.qty}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-gray-800 dark:text-gray-200" title={r.name}>{r.name}</p>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse text-sm text-gray-800 dark:text-gray-200">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <th scope="col" className="w-10 px-2 py-1 text-right font-medium">Qty</th>
              <th scope="col" className="px-2 py-1 font-medium">Name</th>
              <th scope="col" className="w-24 px-2 py-1 font-medium">Zone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-b border-gray-200 dark:border-gray-800">
                <td className="px-2 py-1 text-right tabular-nums">{r.qty}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-1.5">
                    {r.pitch != null && <span className={`h-2 w-2 rounded-full ${PITCH_DOT[r.pitch] ?? "bg-gray-400"}`} aria-hidden />}
                    {r.name}
                  </span>
                </td>
                <td className="px-2 py-1">{ZONE[r.zone] ?? r.zone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const FIELD = "rounded-sm border border-gray-400 bg-white px-1 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-800";
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

/** "Odds in a [4]-card hand: [at least] [3] Boost and [at least] [1] Item → 11.0%"
 *  — multivariate hypergeometric over the library (lib/deck/hand-odds). */
function HandOdds({ deck, ratio }: { deck: DeckDTO; ratio: DeckRatio }) {
  const [handSize, setHandSize] = useState(4);
  const [condA, setCondA] = useState<HandCondition>({ mode: "atLeast", count: 1 });
  const [condB, setCondB] = useState<HandCondition>({ mode: "atLeast", count: 1 });
  // Saved matchup plans (classic page → Matchups): pick one to draw from the
  // library as sided for that matchup; "" = the deck as registered.
  const matchups = ((deck.metadata?.matchups ?? []) as Array<{ heroId: string; sideboard?: MatchupSwaps }>).filter(m => m?.heroId);
  const [matchupId, setMatchupId] = useState("");
  const plan = matchups.find(m => m.heroId === matchupId)?.sideboard;
  const split = useMemo(() => librarySplit(deck, ratio.a, ratio.b, plan), [deck, ratio, plan]);
  const library = split.aOnly + split.bOnly + split.both + split.neither;
  const both = handOdds(split, handSize, condA, ratio.b ? condB : undefined);
  const aAlone = handOdds(split, handSize, condA);
  const bAlone = ratio.b ? handOdds({ aOnly: split.bOnly, bOnly: 0, both: split.both, neither: split.aOnly + split.neither }, handSize, condB) : null;

  const side = (m: Measure, cond: HandCondition, set: (c: HandCondition) => void) => {
    const name = measureLabel(m);
    return (
      <span className="inline-flex items-center gap-1">
        <select aria-label={`${name}: at least or exactly`} value={cond.mode} onChange={e => set({ ...cond, mode: e.target.value as HandCondition["mode"] })} className={FIELD}>
          <option value="atLeast">at least</option>
          <option value="exactly">exactly</option>
        </select>
        <input aria-label={`How many ${name}`} type="number" min={0} max={handSize} value={cond.count} onChange={e => set({ ...cond, count: Math.max(0, Number(e.target.value) || 0) })} className={`${FIELD} w-12`} />
        <span>{name}</span>
      </span>
    );
  };

  return (
    <div role="group" aria-label="Hand odds" className="mb-3 border border-gray-300 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label className="inline-flex items-center gap-1">
          Odds in a
          <input aria-label="Hand size" type="number" min={1} max={library || 1} value={handSize} onChange={e => setHandSize(Math.max(1, Number(e.target.value) || 1))} className={`${FIELD} w-12`} />
          -card hand:
        </label>
        {side(ratio.a, condA, setCondA)}
        {ratio.b && <>and {side(ratio.b, condB, setCondB)}</>}
        <span aria-hidden>→</span>
        <strong role="status" className="tabular-nums">{pct(both)}</strong>
      </div>
      {matchups.length > 0 && (
        <label className="mt-1.5 flex items-center gap-1.5 text-xs">
          Library for
          <select aria-label="Matchup" value={matchupId} onChange={e => setMatchupId(e.target.value)} className={FIELD}>
            <option value="">Base deck (no sideboarding)</option>
            {matchups.map(m => <option key={m.heroId} value={m.heroId}>{matchupDisplayName(m.heroId)} matchup</option>)}
          </select>
        </label>
      )}
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        Drawn from your {library}-card library (main deck, no equipment{plan ? `, sided for ${matchupDisplayName(matchupId)}` : ", no inventory"}).
        {ratio.b && bAlone !== null && <> On their own: {measureLabel(ratio.a)} {pct(aAlone)}, {measureLabel(ratio.b)} {pct(bAlone)}.</>}
      </p>
    </div>
  );
}

export default function RatioCompare({ deck, ratio, style, onClose }: {
  deck: DeckDTO;
  ratio: DeckRatio;
  style: "tiles" | "list";
  onClose: () => void;
}) {
  // Same scope as the counts: main deck + equipment + inventory.
  const rows = useMemo(
    () => buildDeckTableRows(deck).filter(r => r.zone === "maindeck" || r.zone === "equipment" || r.zone === "inventory"),
    [deck],
  );
  const sides = [ratio.a, ...(ratio.b ? [ratio.b] : [])];
  const row = ratioRow(ratio, deck);
  const heading = `${row.label} — ${row.value}${row.note ? ` (${row.note})` : ""}`;

  return (
    <section aria-label={heading} className="mb-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
        <button type="button" onClick={onClose} aria-label="Close comparison" className="text-blue-700 underline hover:no-underline dark:text-blue-400">Close</button>
      </div>
      <HandOdds key={ratio.id} deck={deck} ratio={ratio} />
      <div className="flex items-start gap-3">
        {sides.map((m, i) => (
          <Side key={i} measure={m} rows={rows.filter(r => measureMatches(r.details, m))} style={style} />
        ))}
      </div>
    </section>
  );
}

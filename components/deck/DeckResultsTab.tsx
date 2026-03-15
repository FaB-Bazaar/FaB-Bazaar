"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Sword, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameResultDTO } from "@/lib/services/postgres/gameResults/PostgresGameResultsService";
import type { DeckDTO, DeckPrintingDTO } from "@/lib/services/contracts/IDeckService";

interface CardResult {
  cardId: string;
  cardName: string;
  pitchValue?: number;
  numCopies?: number;
  played: number;
  hits: number;
  blocked: number;
  pitched: number;
  charged?: number;
  discarded?: number;
}

interface TurnResult {
  cardsUsed?: number;
  damageDealt?: number;
  damageTaken?: number;
  resourcesUsed?: number;
  resourcesLeft?: number;
  cardsBlocked?: number;
  cardsPitched?: number;
  damageBlocked?: number;
  damageThreatened?: number;
}

interface Props {
  deckId: string;
  deck?: DeckDTO;
}

function buildCardLookup(deck?: DeckDTO): Map<string, DeckPrintingDTO> {
  const map = new Map<string, DeckPrintingDTO>();
  if (!deck) return map;
  for (const c of [...(deck.maindeck ?? []), ...(deck.equipment ?? []), ...(deck.hero ?? [])]) {
    const name = c.printingDetails?.display_name?.toLowerCase();
    const pitch = c.printingDetails?.pitch ?? 0;
    if (name) map.set(`${name}|${pitch}`, c);
  }
  return map;
}

const PITCH_BORDER: Record<number, string> = {
  1: "border-red-400",
  2: "border-yellow-400",
  3: "border-blue-400",
};

const PITCH_DOT: Record<number, string> = {
  1: "bg-red-400",
  2: "bg-yellow-400",
  3: "bg-blue-400",
};

export default function DeckResultsTab({ deckId, deck }: Props) {
  const [results, setResults] = useState<GameResultDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [showCardStats, setShowCardStats] = useState(false);

  const cardLookup = useMemo(() => buildCardLookup(deck), [deck]);

  const aggregatedCards = useMemo(() => {
    const map = new Map<string, CardResult>();
    for (const game of results) {
      const cards = game.cardResults as CardResult[] | null;
      if (!cards) continue;
      for (const cr of cards) {
        const key = `${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`;
        const existing = map.get(key);
        if (existing) {
          existing.played += cr.played;
          existing.hits += cr.hits;
          existing.blocked += cr.blocked;
          existing.pitched += cr.pitched;
        } else {
          map.set(key, { ...cr });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.played - a.played);
  }, [results]);

  useEffect(() => {
    fetch(`/api/decks/${deckId}/results`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setResults(data.data);
        else setError(data.error);
      })
      .catch(() => setError("Failed to load results"))
      .finally(() => setLoading(false));
  }, [deckId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-8 text-center">{error}</p>;
  }

  if (results.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        <Sword className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No games recorded yet.</p>
        <p className="text-xs mt-1 text-gray-400">Play a game on Talishar with this deck to see results here.</p>
      </div>
    );
  }

  const wins = results.filter(r => r.result === "win").length;
  const losses = results.length - wins;
  const winRate = Math.round((wins / results.length) * 100);

  const firstGames = results.filter(r => r.firstPlayer === true);
  const secondGames = results.filter(r => r.firstPlayer === false);
  const firstWinRate = firstGames.length > 0
    ? Math.round((firstGames.filter(r => r.result === "win").length / firstGames.length) * 100)
    : null;
  const secondWinRate = secondGames.length > 0
    ? Math.round((secondGames.filter(r => r.result === "win").length / secondGames.length) * 100)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <Stat label="Games" value={results.length} />
        <Stat label="Wins" value={wins} color="text-green-600 dark:text-green-400" />
        <Stat label="Losses" value={losses} color="text-red-500 dark:text-red-400" />
        <Stat label="Win Rate" value={`${winRate}%`} />
        {firstWinRate !== null && (
          <Stat label={`Going First (${firstGames.length}g)`} value={`${firstWinRate}%`} />
        )}
        {secondWinRate !== null && (
          <Stat label={`Going Second (${secondGames.length}g)`} value={`${secondWinRate}%`} />
        )}
      </div>

      {/* Card performance */}
      {aggregatedCards.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowCardStats(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            {showCardStats ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            Card Performance
            <span className="text-xs text-gray-400 font-normal ml-1">
              ({aggregatedCards.length} cards · {results.length} games)
            </span>
          </button>
          {showCardStats && (
            <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 font-medium">Card</th>
                    <th className="text-center px-3 py-2 font-medium">Played</th>
                    <th className="text-center px-3 py-2 font-medium">Hits</th>
                    <th className="text-center px-3 py-2 font-medium">Hit%</th>
                    <th className="text-center px-3 py-2 font-medium">Pitched</th>
                    <th className="text-center px-3 py-2 font-medium">Blocked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {aggregatedCards.map(cr => {
                    const deckCard = cardLookup.get(`${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`);
                    const hitPct = cr.played > 0 ? Math.round((cr.hits / cr.played) * 100) : 0;
                    return (
                      <tr key={cr.cardId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 aspect-[63/88] rounded overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
                              <img
                                src={deckCard?.printingDetails?.image_url || "/cardback.webp"}
                                alt={cr.cardName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">
                              {cr.cardName}
                              {cr.pitchValue != null && cr.pitchValue > 0 && (
                                <span className={cn("ml-1.5 inline-block w-2 h-2 rounded-full align-middle", PITCH_DOT[cr.pitchValue] ?? "bg-gray-300")} />
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-1.5 text-gray-700 dark:text-gray-300">{cr.played}</td>
                        <td className="text-center px-3 py-1.5 text-gray-700 dark:text-gray-300">{cr.hits}</td>
                        <td className="text-center px-3 py-1.5">
                          <span className={cn("text-xs font-medium", cr.played > 0 && hitPct >= 50 ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400")}>
                            {cr.played > 0 ? `${hitPct}%` : "—"}
                          </span>
                        </td>
                        <td className="text-center px-3 py-1.5 text-gray-700 dark:text-gray-300">{cr.pitched}</td>
                        <td className="text-center px-3 py-1.5 text-gray-700 dark:text-gray-300">{cr.blocked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Game list */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {results.map(r => {
          const isExpanded = expandedGameId === r.id;
          const cardResults = (r.cardResults as CardResult[] | null)?.filter(cr => cr.played > 0).sort((a, b) => b.played - a.played) ?? [];
          const turnEntries = r.turnResults
            ? Object.entries(r.turnResults as Record<string, TurnResult>)
                .sort(([a], [b]) => parseInt(a.replace("turn_", "")) - parseInt(b.replace("turn_", "")))
            : [];

          return (
            <div key={r.id}>
              <button
                onClick={() => setExpandedGameId(isExpanded ? null : r.id)}
                className="flex items-center gap-3 w-full py-2.5 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <span className={cn(
                  "shrink-0 w-7 text-center text-xs font-bold px-1.5 py-1 rounded-full",
                  r.result === "win"
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                )}>
                  {r.result === "win" ? "W" : "L"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      vs {r.opponentHero ?? "Unknown"}
                    </span>
                    {r.conceded && <span className="text-xs text-gray-400">(conceded)</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {r.format && <span>{r.format}</span>}
                    {r.totalTurns != null && <span>{r.totalTurns} turns</span>}
                    {r.firstPlayer != null && <span>{r.firstPlayer ? "went first" : "went second"}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(r.playedAt).toLocaleDateString()}
                </span>
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                }
              </button>

              {isExpanded && (
                <div className="px-3 pb-4 pt-3 space-y-4 border-t border-gray-100 dark:border-gray-800">

                  {/* Cards played as image tiles */}
                  {cardResults.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Cards Played</p>
                      <div className="flex flex-wrap gap-2">
                        {cardResults.map(cr => {
                          const deckCard = cardLookup.get(`${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`);
                          const imageUrl = deckCard?.printingDetails?.image_url;
                          const printingId = deckCard?.printingId;
                          const borderClass = cr.pitchValue != null ? (PITCH_BORDER[cr.pitchValue] ?? "border-transparent") : "border-transparent";

                          const tile = (
                            <div className="relative group">
                              <div className={cn("w-16 aspect-[63/88] rounded overflow-hidden bg-gray-200 dark:bg-gray-700 border-2", borderClass)}>
                                <img
                                  src={imageUrl || "/cardback.webp"}
                                  alt={cr.cardName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              {/* Play count — top-right, only if >1 */}
                              {cr.played > 1 && (
                                <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                                  {cr.played}
                                </span>
                              )}
                              {/* Hit count — bottom-right, only if >0 */}
                              {cr.hits > 0 && (
                                <span className="absolute -bottom-1 -right-1 bg-green-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                                  {cr.hits}
                                </span>
                              )}
                              {/* Hover tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                                  <div className="font-medium">{cr.cardName}</div>
                                  <div className="text-gray-300 mt-0.5">
                                    played {cr.played}× · {cr.hits} hit · {cr.pitched} pitched
                                    {cr.blocked > 0 && ` · ${cr.blocked} blocked`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );

                          return printingId
                            ? <a key={cr.cardId} href={`/printing/${printingId}`} target="_blank" rel="noopener noreferrer">{tile}</a>
                            : <div key={cr.cardId}>{tile}</div>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Turn breakdown table */}
                  {turnEntries.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Turn Breakdown</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                              <th className="text-left py-1 px-2 font-medium">Turn</th>
                              <th className="text-center py-1 px-2 font-medium">Cards</th>
                              <th className="text-center py-1 px-2 font-medium">Dealt</th>
                              <th className="text-center py-1 px-2 font-medium">Taken</th>
                              <th className="text-center py-1 px-2 font-medium">Resources</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                            {turnEntries.map(([key, t]) => {
                              const num = parseInt(key.replace("turn_", "")) + 1;
                              return (
                                <tr key={key} className="text-gray-700 dark:text-gray-300">
                                  <td className="py-1 px-2 text-gray-400 dark:text-gray-500">{num}</td>
                                  <td className="text-center py-1 px-2">{t.cardsUsed ?? "—"}</td>
                                  <td className={cn("text-center py-1 px-2 font-medium", (t.damageDealt ?? 0) > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400")}>
                                    {t.damageDealt ?? 0}
                                  </td>
                                  <td className={cn("text-center py-1 px-2 font-medium", (t.damageTaken ?? 0) > 0 ? "text-red-500 dark:text-red-400" : "text-gray-400")}>
                                    {t.damageTaken ?? 0}
                                  </td>
                                  <td className="text-center py-1 px-2">{t.resourcesUsed ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-2xl font-bold text-gray-900 dark:text-white", color)}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

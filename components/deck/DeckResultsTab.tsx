"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Loader2, Sword, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GameResultSummaryDTO,
  GameResultDetailDTO,
} from "@/lib/services/postgres/gameResults/PostgresGameResultsService";
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
  cardsLeft?: number;
  cardsBlocked?: number;
  cardsPitched?: number;
  damageBlocked?: number;
  damageThreatened?: number;
}

interface HoverCard {
  imageUrl: string;
  cardName: string;
  statValue: number;
  hitPct: number | null;
  badgeClass: string;
}

interface Props {
  deckId: string;
  deck?: DeckDTO;
}

const PITCH_BORDER: Record<number, string> = {
  1: "border-red-400",
  2: "border-yellow-400",
  3: "border-blue-400",
};

const PITCH_BADGE: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-yellow-400 text-gray-900",
  3: "bg-blue-500 text-white",
};

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

// Secondary lookup: slugified display_name → image URL
// Bridges turn_log cardIds (e.g. "teklo_foundry_heart") to deck cards whose
// display_name slugifies to the same string (spaces→underscores, strip specials).
function buildCardSlugLookup(deck?: DeckDTO): Map<string, string> {
  const map = new Map<string, string>();
  if (!deck) return map;
  for (const c of [...(deck.maindeck ?? []), ...(deck.equipment ?? []), ...(deck.hero ?? [])]) {
    const name = c.printingDetails?.display_name;
    const imageUrl = c.printingDetails?.image_url;
    if (!name || !imageUrl) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    map.set(slug, imageUrl);
  }
  return map;
}

function formatHeroName(name: string): string {
  return name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getCardNameFromId(cardId: string): string {
  return cardId.replace(/_(red|yellow|blue)$/, "").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── GameRow ────────────────────────────────────────────────────────────────

interface GameRowProps {
  game: GameResultSummaryDTO;
  // Populated once the user expands this row and the detail endpoint has
  // returned. The summary shape has no turn-log fields — those live here.
  detail?: GameResultDetailDTO;
  cardLookup: Map<string, DeckPrintingDTO>;
  cardIdLookup: Map<string, string>;
  isExpanded: boolean;
  onToggle: () => void;
  onHover: (data: HoverCard | null) => void;
  onDelete?: (id: string) => Promise<void>;
  playerHeroName?: string;
}

interface TableCellTooltip {
  cards: Array<{ cardId: string; isOpponent: boolean }>;
  x: number;
  y: number;
}

function GameRow({ game, detail, cardLookup, cardIdLookup, isExpanded, onToggle, onHover, onDelete, playerHeroName }: GameRowProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const allCardResults = (game.cardResults as CardResult[] | null) ?? [];

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(game.id);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };
  const [tableCellTooltip, setTableCellTooltip] = useState<TableCellTooltip | null>(null);

  const cardResultMap = useMemo(() => {
    const map = new Map<string, CardResult>();
    for (const cr of allCardResults) {
      if (cr.cardName) map.set(`${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`, cr);
    }
    return map;
  }, [allCardResults]);

  const opponentCardResultMap = useMemo(() => {
    const map = new Map<string, CardResult>();
    const cards = (game.opponentCardResults as CardResult[] | null) ?? [];
    for (const cr of cards) {
      if (cr.cardId) map.set(cr.cardId, cr);
    }
    return map;
  }, [game.opponentCardResults]);

  // Process both turn_logs into per-turn groups, merging HIT flags and opponent entries.
  // Turn-log data comes from the detail endpoint, fetched lazily on expand.
  const turnLogByTurn = useMemo(() => {
    const playerLog = detail?.turnLog as [number, string, string][] | null | undefined;
    const opponentLog = detail?.opponentTurnLog as [number, string, string][] | null | undefined;
    if (!playerLog?.length && !opponentLog?.length) return null;

    const playerTurnIdx = game.firstPlayer ? 0 : 1;

    const playerHitSet = new Set((playerLog ?? []).filter(e => e[2] === "HIT").map(e => `${e[0]}-${e[1]}`));
    const opponentHitSet = new Set((opponentLog ?? []).filter(e => e[2] === "HIT").map(e => `${e[0]}-${e[1]}`));

    const byTurn = new Map<number, Array<{ cardId: string; action: string; hit: boolean; isOpponent: boolean }>>();

    const addEntries = (log: [number, string, string][], hitSet: Set<string>, isOpponent: boolean) => {
      for (const [turn, cardId, action] of log) {
        if (action === "HIT") continue;
        if (!byTurn.has(turn)) byTurn.set(turn, []);
        byTurn.get(turn)!.push({ cardId, action, hit: action === "M" && hitSet.has(`${turn}-${cardId}`), isOpponent });
      }
    };

    if (playerLog?.length) addEntries(playerLog, playerHitSet, false);
    if (opponentLog?.length) addEntries(opponentLog, opponentHitSet, true);

    // Within each turn group: attacker's cards first, then defender reactions
    for (const [turnIdx, entries] of byTurn.entries()) {
      const isYourTurn = turnIdx % 2 === playerTurnIdx;
      entries.sort((a, b) => {
        const aAttacks = isYourTurn ? !a.isOpponent : a.isOpponent;
        const bAttacks = isYourTurn ? !b.isOpponent : b.isOpponent;
        if (aAttacks && !bAttacks) return -1;
        if (!aAttacks && bAttacks) return 1;
        return 0;
      });
    }

    return { byTurn, playerTurnIdx };
  }, [detail?.turnLog, detail?.opponentTurnLog, game.firstPlayer]);

  const turnResults = detail?.turnResults
    ? Object.entries(detail.turnResults as Record<string, TurnResult>).sort(([a], [b]) => parseInt(a.replace("turn_", "")) - parseInt(b.replace("turn_", "")))
    : [];

  const gameSections: Array<{ label: string; cards: CardResult[]; statKey: "played" | "pitched" | "blocked" }> = [
    { label: "PLAYED", cards: [...cardResultMap.values()].filter(c => c.played > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "played" },
    { label: "PITCHED", cards: [...cardResultMap.values()].filter(c => c.pitched > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "pitched" },
    { label: "BLOCKED", cards: [...cardResultMap.values()].filter(c => c.blocked > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "blocked" },
  ];

  return (
    <div>
      <div className="group flex items-stretch">
        <button
          data-testid="game-row-toggle"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 py-2.5 pl-3 pr-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span className={cn(
            "shrink-0 w-7 text-center text-xs font-bold px-1.5 py-1 rounded-full",
            game.result === "win"
              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
              : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
          )}>
            {game.result === "win" ? "W" : "L"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                vs {game.opponentHero ? formatHeroName(game.opponentHero) : "Unknown"}
              </span>
              {game.conceded && <span className="text-xs text-gray-400">(conceded)</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {game.format && <span>Format {game.format}</span>}
              {game.totalTurns != null && <span>{game.totalTurns} turns</span>}
              {game.firstPlayer != null && <span>{game.firstPlayer ? "went first" : "went second"}</span>}
            </div>
          </div>
          <span className="shrink-0 text-xs text-gray-400">
            {new Date(game.playedAt).toLocaleDateString()}
          </span>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        </button>

        {onDelete && (
          <div className="flex items-center pr-3 pl-2 shrink-0">
            {deleteConfirm ? (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-500 hover:text-red-400 font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded px-0.5"
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(false); }}
                  className="text-gray-400 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded px-0.5"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(true); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                title="Delete this game"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 pb-4 pt-3 space-y-4">

          {/* Turn summary table */}
          {turnResults.length > 0 && (() => {
            const playerTurnIdx = game.firstPlayer ? 0 : 1;
            const playerLabel = playerHeroName ? formatHeroName(playerHeroName) : "You";
            const opponentLabel = game.opponentHero ? formatHeroName(game.opponentHero) : "Opp";
            return (
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 uppercase">Turn Summary</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-1 px-2 font-medium">Turn</th>
                        <th className="text-left py-1 px-2 font-medium">Hero</th>
                        <th className="text-center py-1 px-2 font-medium">Played</th>
                        <th className="text-center py-1 px-2 font-medium">Pitched</th>
                        <th className="text-center py-1 px-2 font-medium">Blocked</th>
                        <th className="text-center py-1 px-2 font-medium">Dealt</th>
                        <th className="text-center py-1 px-2 font-medium">Taken</th>
                        <th className="text-center py-1 px-2 font-medium">Res</th>
                        <th className="text-center py-1 px-2 font-medium leading-tight">Hand<br />Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnResults.map(([key, t]) => {
                        const idx = parseInt(key.replace("turn_", ""));
                        const turnEntries = turnLogByTurn?.byTurn.get(idx) ?? [];
                        const tPlayerEs = turnEntries.filter(e => !e.isOpponent);
                        const tOppEs = turnEntries.filter(e => e.isOpponent);
                        const tOppAttacks = tOppEs.some(e => e.action === "M");
                        const tPlayerAttacks = tPlayerEs.some(e => e.action === "M");
                        const tPlayerBlocks = tPlayerEs.some(e => e.action === "B");
                        const tHasInstant = turnEntries.some(e => e.action === "INSTANT");
                        const isPlayerTurn = (tOppAttacks && tPlayerAttacks) ? (idx % 2 === playerTurnIdx) : tOppAttacks ? false : tPlayerAttacks ? true : tPlayerBlocks ? false : tHasInstant ? false : idx % 2 === playerTurnIdx;
                        const playedCards = turnEntries.filter(e => e.action === "M");
                        const pitchedCards = turnEntries.filter(e => e.action === "P");
                        const blockedCards = turnEntries.filter(e => e.action === "B");
                        const showTooltip = (e: React.MouseEvent<HTMLTableCellElement>, cards: typeof turnEntries) => {
                          if (cards.length === 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTableCellTooltip({ cards, x: rect.left + rect.width / 2, y: rect.top });
                        };
                        return (
                          <tr key={key} className="text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1 px-2 text-gray-600 dark:text-gray-400 text-center font-medium whitespace-nowrap">
                              Turn {idx}
                            </td>
                            <td className="py-1 px-2">
                              <span className="flex items-center gap-1.5">
                                <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded shrink-0", isPlayerTurn ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-orange-100 dark:bg-orange-900/40 text-orange-500 dark:text-orange-400")}>
                                  {isPlayerTurn ? "YOU" : "OPP"}
                                </span>
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {isPlayerTurn ? (playerHeroName ?? "—") : opponentLabel}
                                </span>
                              </span>
                            </td>
                            <td className="text-center py-1 px-2 cursor-default" onMouseEnter={e => showTooltip(e, playedCards)} onMouseLeave={() => setTableCellTooltip(null)}>{t.cardsUsed ?? "—"}</td>
                            <td className="text-center py-1 px-2 cursor-default" onMouseEnter={e => showTooltip(e, pitchedCards)} onMouseLeave={() => setTableCellTooltip(null)}>{t.cardsPitched ?? "—"}</td>
                            <td className="text-center py-1 px-2 cursor-default" onMouseEnter={e => showTooltip(e, blockedCards)} onMouseLeave={() => setTableCellTooltip(null)}>{t.cardsBlocked ?? "—"}</td>
                            <td className={cn("text-center py-1 px-2 font-medium", (t.damageDealt ?? 0) > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400")}>{t.damageDealt ?? 0}</td>
                            <td className={cn("text-center py-1 px-2 font-medium", (t.damageTaken ?? 0) > 0 ? "text-red-500 dark:text-red-400" : "text-gray-400")}>{t.damageTaken ?? 0}</td>
                            <td className="text-center py-1 px-2">{t.resourcesUsed ?? "—"}</td>
                            <td className="text-center py-1 px-2 text-gray-400">{t.cardsLeft ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Turn-by-turn play log with card images */}
          {/* Loading skeleton while the detail endpoint resolves the turn log. */}
          {!detail && (
            <div className="px-4 py-6 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading turn log…
            </div>
          )}
          {turnLogByTurn && turnLogByTurn.byTurn.size > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Play by Play</p>
              {Array.from(turnLogByTurn.byTurn.entries()).sort(([a], [b]) => a - b).map(([turnNum, entries]) => {
                const tr = (detail?.turnResults as Record<string, TurnResult> | null)?.[`turn_${turnNum}`];
                const playerEs = entries.filter(e => !e.isOpponent);
                const oppEs = entries.filter(e => e.isOpponent);
                const oppAttacks = oppEs.some(e => e.action === "M");
                const playerAttacks = playerEs.some(e => e.action === "M");
                const playerBlocks = playerEs.some(e => e.action === "B");
                const hasInstant = entries.some(e => e.action === "INSTANT");
                const isYourTurn = (oppAttacks && playerAttacks) ? (turnNum % 2 === turnLogByTurn.playerTurnIdx)
                  : oppAttacks ? false
                  : playerAttacks ? true
                  : playerBlocks ? false
                  : hasInstant ? false
                  : turnNum % 2 === turnLogByTurn.playerTurnIdx;
                return (
                  <div key={turnNum}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest shrink-0">
                        Turn {turnNum}
                      </span>
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", isYourTurn ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400")}>
                        {isYourTurn ? "your turn" : "opp turn"}
                      </span>
                      {tr && (
                        <span className="flex items-center gap-2 text-xs">
                          {(tr.damageThreatened ?? 0) > 0 && <span className="text-orange-500 dark:text-orange-400 font-medium">{tr.damageThreatened} threatened</span>}
                          {(tr.damageDealt ?? 0) > 0 && <span className="text-green-600 dark:text-green-400 font-medium">+{tr.damageDealt} dealt</span>}
                          {(tr.damageTaken ?? 0) > 0 && <span className="text-red-500 dark:text-red-400 font-medium">−{tr.damageTaken} taken</span>}
                          {(tr.damageBlocked ?? 0) > 0 && <span className="text-blue-500 dark:text-blue-400 font-medium">{tr.damageBlocked} blocked</span>}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const isOff = (a: string) => a === "M" || a === "P" || a === "INSTANT";
                      const isDef = (a: string) => a === "B" || a === "D";
                      const playerLabel = playerHeroName ?? "You";
                      const oppLabel = game.opponentHero ? formatHeroName(game.opponentHero) : "Opponent";

                      // Split each turn cycle into two half-turns:
                      // 1) Attacker A plays (M/P/INSTANT), Defender B responds (B/D)
                      // 2) Attacker B plays (M/P/INSTANT), Defender A responds (B/D)
                      const oppOffensive = oppEs.filter(e => isOff(e.action));
                      const oppDefensive = oppEs.filter(e => isDef(e.action));
                      const playerOffensive = playerEs.filter(e => isOff(e.action));
                      const playerDefensive = playerEs.filter(e => isDef(e.action));

                      // Half-turn where OPP attacks and YOU defend
                      const oppAttackHalf = [...oppOffensive, ...playerDefensive].length > 0
                        ? [
                            { isOpponent: true,  label: oppLabel,    cards: oppOffensive },
                            { isOpponent: false, label: playerLabel,  cards: playerDefensive },
                          ].filter(r => r.cards.length > 0)
                        : null;

                      // Half-turn where YOU attack and OPP defends
                      const playerAttackHalf = [...playerOffensive, ...oppDefensive].length > 0
                        ? [
                            { isOpponent: false, label: playerLabel,  cards: playerOffensive },
                            { isOpponent: true,  label: oppLabel,    cards: oppDefensive },
                          ].filter(r => r.cards.length > 0)
                        : null;

                      // Attacker for this cycle goes first
                      const phases = (isYourTurn
                        ? [playerAttackHalf, oppAttackHalf]
                        : [oppAttackHalf, playerAttackHalf]
                      ).filter(Boolean) as NonNullable<typeof oppAttackHalf>[];

                      const renderCard = (entry: typeof entries[0], i: number) => {
                        const imageUrl = cardIdLookup.get(entry.cardId);
                        const cardName = getCardNameFromId(entry.cardId);
                        const cr = entry.isOpponent
                          ? opponentCardResultMap.get(entry.cardId)
                          : allCardResults.find(c => c.cardId === entry.cardId);
                        const pitchValue = cr?.pitchValue;
                        const border = entry.isOpponent
                          ? "border-orange-400 dark:border-orange-500"
                          : entry.action === "P" && pitchValue != null && pitchValue > 0
                          ? (PITCH_BORDER[pitchValue] ?? "border-gray-300 dark:border-gray-600")
                          : entry.action === "B"
                          ? "border-blue-400"
                          : "border-gray-300 dark:border-gray-600";
                        return (
                          <div
                            key={`${entry.cardId}-${entry.action}-${i}`}
                            className="shrink-0 flex flex-col items-center gap-1"
                            style={{ width: 80 }}
                            onMouseEnter={() => imageUrl && onHover({ imageUrl, cardName, statValue: 0, hitPct: null, badgeClass: "bg-gray-700 text-white" })}
                            onMouseLeave={() => onHover(null)}
                          >
                            <div className={cn("relative w-full rounded overflow-hidden border-2", border)} style={{ aspectRatio: "63/53" }}>
                              <img src={imageUrl || "/cardback.webp"} alt={cardName} className="w-full block" loading="lazy" />
                              {entry.action === "B" && <div className="absolute bottom-1 left-1 bg-blue-600/90 text-white text-xs font-bold px-1 py-0.5 rounded leading-none">BLK</div>}
                              {entry.action === "D" && <div className="absolute bottom-1 left-1 bg-purple-600/90 text-white text-xs font-bold px-1 py-0.5 rounded leading-none">DR</div>}
                              {entry.action === "P" && pitchValue != null && pitchValue > 0 && (
                                <div className={cn("absolute bottom-1 left-1 text-xs font-bold px-1 py-0.5 rounded leading-none", PITCH_BADGE[pitchValue] ?? "bg-gray-500 text-white")}>Pitch</div>
                              )}
                              {entry.hit && <div className="absolute top-0.5 right-0.5 bg-green-500 text-white text-xs font-bold px-1 py-0.5 rounded leading-none">HIT</div>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight w-full truncate">{cardName}</p>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-3">
                          {phases.map((rows, phaseIdx) => (
                            <div key={phaseIdx} className={cn("space-y-2", phaseIdx > 0 && "pt-2 border-t border-gray-100 dark:border-gray-800")}>
                              {rows.map(({ isOpponent, label, cards }) => (
                                <div key={String(isOpponent)}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", isOpponent ? "bg-orange-100 dark:bg-orange-900/40 text-orange-500 dark:text-orange-400" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400")}>
                                      {isOpponent ? "OPP" : "YOU"}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {cards.map((entry, i) => renderCard(entry, i))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-game card sections: PLAYED / PITCHED / BLOCKED */}
          {gameSections.some(({ cards }) => cards.length > 0) && (
            <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Card Summary</p>
          )}
          {gameSections.map(({ label, cards, statKey }) => {
            if (cards.length === 0) return null;
            return (
              <div key={label}>
                <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cards.map(cr => {
                    const deckCard = cr.cardName ? cardLookup.get(`${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`) : undefined;
                    const pitchSuffix = cr.pitchValue === 1 ? '_red' : cr.pitchValue === 2 ? '_yellow' : cr.pitchValue === 3 ? '_blue' : '';
                    const imageUrl = deckCard?.printingDetails?.image_url
                      ?? (cr.cardId ? cardIdLookup.get(cr.cardId) : undefined)
                      ?? (cr.cardId && pitchSuffix ? cardIdLookup.get(`${cr.cardId}${pitchSuffix}`) : undefined);
                    const printingId = deckCard?.printingId;
                    const statValue = cr[statKey];
                    const isAttack = deckCard?.printingDetails?.types?.some(t => t.toLowerCase() === "attack") ?? false;
                    const hitPct = statKey === "played" && isAttack && cr.played > 0 ? Math.round((cr.hits / cr.played) * 100) : null;
                    const pitchBorder = cr.pitchValue != null && cr.pitchValue > 0 ? (PITCH_BORDER[cr.pitchValue] ?? "border-gray-400 dark:border-gray-600") : "border-gray-400 dark:border-gray-600";
                    const badgeClass = cr.pitchValue != null && cr.pitchValue > 0 ? (PITCH_BADGE[cr.pitchValue] ?? "bg-gray-500 text-white") : "bg-gray-500 text-white";

                    const tile = (
                      <div
                        className="shrink-0 flex flex-col items-center gap-1"
                        style={{ width: 72 }}
                        onMouseEnter={() => imageUrl && onHover({ imageUrl, cardName: cr.cardName, statValue, hitPct, badgeClass })}
                        onMouseLeave={() => onHover(null)}
                      >
                        <div className={cn("relative w-full rounded overflow-hidden border-2", pitchBorder)} style={{ aspectRatio: "63/53" }}>
                          <img src={imageUrl || "/cardback.webp"} alt={cr.cardName} className="w-full block" loading="lazy" />
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                            <span className={cn("flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold", badgeClass)}>{statValue}</span>
                          </div>
                          {hitPct !== null && (
                            <div className="absolute top-1 right-1">
                              <span className={cn("text-[9px] font-semibold px-1 py-0.5 rounded leading-none", hitPct >= 50 ? "bg-green-600 text-white" : "bg-black/50 text-gray-300")}>{hitPct}%</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight w-full truncate">{cr.cardName}</p>
                      </div>
                    );
                    return printingId
                      ? <a key={`${cr.cardId}-${cr.pitchValue}-${statKey}`} href={`/printing/${printingId}`} target="_blank" rel="noopener noreferrer" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">{tile}</a>
                      : <div key={`${cr.cardId}-${cr.pitchValue}-${statKey}`}>{tile}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fixed-position card tooltip for turn summary table cells */}
      {tableCellTooltip && (
        <div
          className="fixed z-50 flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 shadow-xl pointer-events-none"
          style={{ left: tableCellTooltip.x, top: tableCellTooltip.y - 8, transform: "translate(-50%, -100%)" }}
        >
          {tableCellTooltip.cards.map((entry, i) => (
            <div key={i} className={cn("rounded overflow-hidden border-2", entry.isOpponent ? "border-orange-400 dark:border-orange-500" : "border-blue-400 dark:border-blue-500")}>
              <img
                src={cardIdLookup.get(entry.cardId) ?? "/cardback.webp"}
                alt={getCardNameFromId(entry.cardId)}
                style={{ width: 44, display: "block" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DeckResultsTab({ deckId, deck }: Props) {
  const [results, setResults] = useState<GameResultSummaryDTO[]>([]);
  // Cache of detail responses keyed by result id. Populated lazily when the
  // user expands a row. Once fetched, the entry stays cached for the lifetime
  // of the component so re-expanding is instant.
  const [detailById, setDetailById] = useState<Map<string, GameResultDetailDTO>>(new Map());
  const inFlightDetail = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [showCardStats, setShowCardStats] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["never-used"]));
  const [heroFilter, setHeroFilter] = useState<string>("all");
  const [hoveredCard, setHoveredCard] = useState<HoverCard | null>(null);
  const mouseXRef = useRef(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => { mouseXRef.current = e.clientX; };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const toggleSection = (id: string) =>
    setCollapsedSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const handleDeleteGame = async (resultId: string) => {
    const res = await fetch(`/api/decks/${deckId}/results/${resultId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? 'Failed to delete game');
    setResults(prev => prev.filter(r => r.id !== resultId));
    setTotal(prev => prev - 1);
  };

  const cardLookup = useMemo(() => buildCardLookup(deck), [deck]);
  const cardSlugLookup = useMemo(() => buildCardSlugLookup(deck), [deck]);

  // cardId (e.g. "jump_start_red") → image URL.
  // Prefer the player's own deck-card printing when available (gives the user's
  // chosen art and the printingId for /printing/[id] links), then fall back to
  // images resolved by the by-talishar-id endpoint.
  const cardIdLookup = useMemo(() => {
    const map = new Map<string, string>();

    // Pass 1: card_results → deck card via name+pitch (preserves the deck's
    // own printing for the player's cards).
    for (const game of results) {
      const cards = game.cardResults as CardResult[] | null;
      if (!cards) continue;
      for (const cr of cards) {
        if (!cr.cardId || map.has(cr.cardId)) continue;
        const deckCard = cardLookup.get(`${cr.cardName?.toLowerCase()}|${cr.pitchValue ?? 0}`);
        if (deckCard?.printingDetails?.image_url) map.set(cr.cardId, deckCard.printingDetails.image_url);
      }
    }

    // Pass 2: turn_log cardIds (only available for games the user has
    // expanded) → deck card via slug match. Equipment, heroes, and tokens
    // never appear in card_results, so this pass is what keeps "use the
    // deck's printing" working for them.
    const pitchSuffixes = ["_red", "_yellow", "_blue"];
    for (const detail of detailById.values()) {
      const log = detail.turnLog as [number, string, string][] | null | undefined;
      if (!log) continue;
      for (const [, cardId] of log) {
        if (map.has(cardId)) continue;
        let slug = cardId;
        if (slug.endsWith("_equip")) slug = slug.slice(0, -"_equip".length);
        for (const suffix of pitchSuffixes) {
          if (slug.endsWith(suffix)) { slug = slug.slice(0, -suffix.length); break; }
        }
        const imageUrl = cardSlugLookup.get(slug) ?? cardSlugLookup.get(cardId);
        if (imageUrl) map.set(cardId, imageUrl);
      }
    }

    // Pass 3: server-resolved imageUrls inlined on every summary row
    // (covers cardResults + opponentCardResults for every loaded game) plus
    // any expanded-detail imageUrls (covers turn-log cardIds too).
    for (const game of results) {
      for (const [cardId, imageUrl] of Object.entries(game.imageUrls ?? {})) {
        if (!map.has(cardId) && imageUrl) map.set(cardId, imageUrl);
      }
    }
    for (const detail of detailById.values()) {
      for (const [cardId, imageUrl] of Object.entries(detail.imageUrls ?? {})) {
        if (!map.has(cardId) && imageUrl) map.set(cardId, imageUrl);
      }
    }

    return map;
  }, [results, detailById, cardLookup, cardSlugLookup]);

  // Unique heroes in order of first appearance
  const uniqueHeroes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const r of results) {
      if (r.opponentHero && !seen.has(r.opponentHero)) { seen.add(r.opponentHero); ordered.push(r.opponentHero); }
    }
    return ordered;
  }, [results]);

  const filteredResults = useMemo(() =>
    heroFilter === "all" ? results : results.filter(r => r.opponentHero === heroFilter),
    [results, heroFilter]
  );

  const aggregatedCards = useMemo(() => {
    const map = new Map<string, CardResult>();
    for (const game of filteredResults) {
      const cards = game.cardResults as CardResult[] | null;
      if (!cards) continue;
      for (const cr of cards) {
        if (!cr.cardName) continue;
        const key = `${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`;
        const existing = map.get(key);
        if (existing) {
          existing.played += cr.played; existing.hits += cr.hits;
          existing.blocked += cr.blocked; existing.pitched += cr.pitched;
        } else {
          map.set(key, { ...cr });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.played - a.played);
  }, [filteredResults]);

  useEffect(() => {
    fetch(`/api/decks/${deckId}/results?limit=20&offset=0`)
      .then(r => r.json())
      .then(data => {
        if (data.success) { setResults(data.data); setTotal(data.total ?? data.data.length); }
        else setError(data.error);
      })
      .catch(() => setError("Failed to load results"))
      .finally(() => setLoading(false));
  }, [deckId]);

  const loadMore = () => {
    setLoadingMore(true);
    fetch(`/api/decks/${deckId}/results?limit=20&offset=${results.length}`)
      .then(r => r.json())
      .then(data => { if (data.success) setResults(prev => [...prev, ...data.data]); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Fetch the heavy detail (turn logs, turnResults) for a game only when the
  // user expands its row. Cached forever in component state — re-expand hits
  // the cache. Guards against duplicate in-flight fetches.
  useEffect(() => {
    if (!expandedGameId) return;
    if (detailById.has(expandedGameId)) return;
    if (inFlightDetail.current.has(expandedGameId)) return;
    inFlightDetail.current.add(expandedGameId);
    fetch(`/api/decks/${deckId}/results/${expandedGameId}`)
      .then(r => r.json())
      .then((response: { success: boolean; data?: GameResultDetailDTO }) => {
        if (response.success && response.data) {
          setDetailById(prev => new Map(prev).set(response.data!.id, response.data!));
        }
      })
      .catch(() => {})
      .finally(() => { inFlightDetail.current.delete(expandedGameId); });
  }, [deckId, expandedGameId, detailById]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (error) return <p className="text-sm text-red-500 py-8 text-center">{error}</p>;
  if (results.length === 0) return (
    <div className="py-16 text-center text-gray-500 dark:text-gray-400">
      <Sword className="h-8 w-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">No games recorded yet.</p>
      <p className="text-xs mt-1 text-gray-400">Play a game on Talishar with this deck to see results here.</p>
    </div>
  );

  const wins = filteredResults.filter(r => r.result === "win").length;
  const losses = filteredResults.length - wins;
  const winRate = filteredResults.length > 0 ? Math.round((wins / filteredResults.length) * 100) : 0;
  const firstGames = filteredResults.filter(r => r.firstPlayer === true);
  const secondGames = filteredResults.filter(r => r.firstPlayer === false);
  const firstWinRate = firstGames.length > 0 ? Math.round((firstGames.filter(r => r.result === "win").length / firstGames.length) * 100) : null;
  const secondWinRate = secondGames.length > 0 ? Math.round((secondGames.filter(r => r.result === "win").length / secondGames.length) * 100) : null;

  const renderAggTile = (cr: CardResult, statKey: "played" | "pitched" | "blocked", sectionId: string) => {
    const deckCard = cr.cardName ? cardLookup.get(`${cr.cardName.toLowerCase()}|${cr.pitchValue ?? 0}`) : undefined;
    const pitchSuffix = cr.pitchValue === 1 ? '_red' : cr.pitchValue === 2 ? '_yellow' : cr.pitchValue === 3 ? '_blue' : '';
    const imageUrl = deckCard?.printingDetails?.image_url
      ?? (cr.cardId ? cardIdLookup.get(cr.cardId) : undefined)
      ?? (cr.cardId && pitchSuffix ? cardIdLookup.get(`${cr.cardId}${pitchSuffix}`) : undefined);
    const printingId = deckCard?.printingId;
    const statValue = cr[statKey];
    const isAttack = deckCard?.printingDetails?.types?.some(t => t.toLowerCase() === "attack") ?? false;
    const hitPct = statKey === "played" && isAttack && cr.played > 0 ? Math.round((cr.hits / cr.played) * 100) : null;
    const pitchBorder = cr.pitchValue != null && cr.pitchValue > 0 ? (PITCH_BORDER[cr.pitchValue] ?? "border-gray-400 dark:border-gray-600") : "border-gray-400 dark:border-gray-600";
    const badgeClass = cr.pitchValue != null && cr.pitchValue > 0 ? (PITCH_BADGE[cr.pitchValue] ?? "bg-gray-500 text-white") : "bg-gray-500 text-white";

    const tile = (
      <div
        className="shrink-0 flex flex-col items-center gap-1"
        style={{ width: 88 }}
        onMouseEnter={() => imageUrl && setHoveredCard({ imageUrl, cardName: cr.cardName, statValue, hitPct, badgeClass })}
        onMouseLeave={() => setHoveredCard(null)}
      >
        <div className={cn("relative w-full rounded overflow-hidden border-2", pitchBorder)} style={{ aspectRatio: "63/53" }}>
          <img src={imageUrl || "/cardback.webp"} alt={cr.cardName} className="w-full block" loading="lazy" />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
            <span className={cn("flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold", badgeClass)}>{statValue}</span>
          </div>
          {hitPct !== null && (
            <div className="absolute top-1 right-1">
              <span className={cn("text-[9px] font-semibold px-1 py-0.5 rounded leading-none", hitPct >= 50 ? "bg-green-600 text-white" : "bg-black/50 text-gray-300")}>{hitPct}%</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight w-full truncate">{cr.cardName}</p>
      </div>
    );

    return printingId
      ? <a key={`${cr.cardId}-${cr.pitchValue}-${sectionId}`} href={`/printing/${printingId}`} target="_blank" rel="noopener noreferrer" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">{tile}</a>
      : <div key={`${cr.cardId}-${cr.pitchValue}-${sectionId}`}>{tile}</div>;
  };

  return (
    <>
      <div className="space-y-4">

        {/* Hero filter tabs */}
        {uniqueHeroes.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setHeroFilter("all")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                heroFilter === "all"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {heroFilter === "all" ? "✓ " : ""}All ({results.length})
            </button>
            {uniqueHeroes.map(hero => {
              const heroGames = results.filter(r => r.opponentHero === hero);
              const heroWins = heroGames.filter(r => r.result === "win").length;
              return (
                <button
                  key={hero}
                  onClick={() => setHeroFilter(hero)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    heroFilter === hero
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {heroFilter === hero ? "✓ " : ""}{formatHeroName(hero)} ({heroWins}W–{heroGames.length - heroWins}L)
                </button>
              );
            })}
          </div>
        )}

        {/* Summary stats */}
        {filteredResults.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <Stat label="Games" value={filteredResults.length} />
            <Stat label="Wins" value={wins} color="text-green-600 dark:text-green-400" />
            <Stat label="Losses" value={losses} color="text-red-500 dark:text-red-400" />
            <Stat label="Win Rate" value={`${winRate}%`} />
            {firstWinRate !== null && <Stat label={`Going First (${firstGames.length}g)`} value={`${firstWinRate}%`} />}
            {secondWinRate !== null && <Stat label={`Going Second (${secondGames.length}g)`} value={`${secondWinRate}%`} />}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No games vs {formatHeroName(heroFilter)}.
          </p>
        )}

        {/* Aggregated card performance */}
        {aggregatedCards.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowCardStats(v => !v)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {showCardStats ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              Card Performance
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({aggregatedCards.length} cards · {filteredResults.length}{total > results.length ? ` of ${total}` : ""} games{heroFilter !== "all" ? ` vs ${formatHeroName(heroFilter)}` : ""})
              </span>
            </button>
            {showCardStats && (() => {
              const aggSections: Array<{ id: string; title: string; cards: CardResult[]; statKey: "played" | "pitched" | "blocked" }> = [
                { id: "played", title: "PLAYED", cards: [...aggregatedCards].filter(cr => cr.played > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "played" },
                { id: "pitched", title: "PITCHED", cards: [...aggregatedCards].filter(cr => cr.pitched > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "pitched" },
                { id: "blocked", title: "BLOCKED", cards: [...aggregatedCards].filter(cr => cr.blocked > 0).sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "") || (a.pitchValue ?? 0) - (b.pitchValue ?? 0)), statKey: "blocked" },
              ];
              const neverUsed = aggregatedCards.filter(cr => cr.played === 0 && cr.pitched === 0 && cr.blocked === 0);
              return (
                <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {aggSections.map(({ id, title, cards, statKey }) => {
                    if (cards.length === 0) return null;
                    const collapsed = collapsedSections.has(id);
                    return (
                      <div key={id}>
                        <button onClick={() => toggleSection(id)} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                          <span className="text-xs font-bold tracking-widest text-gray-600 dark:text-gray-300 flex-1">{title}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({cards.length})</span>
                          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                        </button>
                        {!collapsed && (
                          <div className="px-3 pb-3 pt-1">
                            <div className="flex flex-wrap gap-2">{cards.map(cr => renderAggTile(cr, statKey, id))}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {neverUsed.length > 0 && (
                    <div>
                      <button onClick={() => toggleSection("never-used")} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                        <span className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 flex-1">NEVER USED</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({neverUsed.length})</span>
                        {collapsedSections.has("never-used") ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                      </button>
                      {!collapsedSections.has("never-used") && (
                        <div className="px-3 pb-3 pt-1">
                          <div className="flex flex-wrap gap-2">{neverUsed.map(cr => renderAggTile(cr, "played", "never-used"))}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Game list */}
        {filteredResults.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {filteredResults.map(r => (
              <GameRow
                key={r.id}
                game={r}
                detail={detailById.get(r.id)}
                cardLookup={cardLookup}
                cardIdLookup={cardIdLookup}
                isExpanded={expandedGameId === r.id}
                onToggle={() => setExpandedGameId(expandedGameId === r.id ? null : r.id)}
                onHover={setHoveredCard}
                onDelete={handleDeleteGame}
                playerHeroName={deck?.hero?.[0]?.printingDetails?.display_name ?? (deck?.heroName ? formatHeroName(deck.heroName) : undefined)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {results.length < total && (
          <div className="flex justify-center pt-1">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-4 py-2 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {loadingMore ? "Loading..." : `Load more (${total - results.length} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Hover card preview */}
      {hoveredCard && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <div className="relative w-56 rounded-xl overflow-hidden shadow-2xl border border-gray-600">
            <img src={hoveredCard.imageUrl} alt={hoveredCard.cardName} className="w-full block" />
            {hoveredCard.statValue > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className={cn("flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shadow-lg", hoveredCard.badgeClass)}>{hoveredCard.statValue}</span>
              </div>
            )}
            {hoveredCard.hitPct !== null && (
              <div className="absolute top-2 right-2">
                <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded leading-none shadow", hoveredCard.hitPct >= 50 ? "bg-green-600 text-white" : "bg-black/60 text-gray-300")}>{hoveredCard.hitPct}% hit</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-2xl font-bold text-gray-900 dark:text-white", color)}>{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}

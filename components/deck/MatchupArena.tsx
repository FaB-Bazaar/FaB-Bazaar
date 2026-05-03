// components/deck/MatchupArena.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Pencil, Settings2, Swords, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { decksClient } from "@/lib/client";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { HERO_INFO, YOUNG_HERO_INFO } from "@/lib/fab-constants";
import { getHeroPortraitUrl } from "@/lib/fab-constants/heroPortraits";
import {
  STRATEGY_IDS,
  getStrategyDisplayName,
  getStrategyPortraitUrl,
  isStrategyId,
} from "@/lib/fab-constants/strategyPortraits";
import { getBannedCardIds, getLivingLegendHeroIds } from "@/lib/fab-banned-cards";
import { toTalisharIdentifier } from "@/lib/utils";
import { canEditDeck } from "@/lib/utils/deck-permissions";
import { computeMatchupRecords, type MatchupRecord } from "@/lib/utils/matchup-records";
import { computeMatchupBreakdown } from "@/lib/utils/matchup-breakdown";
import MatchupDeltaView from "@/components/deck/MatchupDeltaView";
import { BreakdownChip } from "@/components/deck/MatchupBreakdownChip";
import { computeMatchupDelta } from "@/lib/utils/matchup-delta";
import { Button } from "@/components/ui/button";

// Defer the heavy editor dialog (and its MatchupSideboardEditor child) until needed.
const DeckMatchupsDialog = dynamic(() => import("@/components/deck/DeckMatchupsDialog"), {
  ssr: false,
});

interface DeckMatchup {
  heroId: string;
  preferredTurnOrder: "First" | "Second" | "NoPreference" | null;
  notes: string | null;
  sideboard: { in: string[]; out: string[] };
}

interface ResultLike {
  opponentHero?: string | null;
  result: "win" | "loss";
}

interface HeroOption {
  canonicalKey: string;
  talisharId: string;
  displayName: string;
  className: string;
}

function toDisplayName(key: string): string {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getHeroOptionsForFormat(format?: string): HeroOption[] {
  const bannedIds = getBannedCardIds(format || "");
  const livingLegendIds = getLivingLegendHeroIds(format || "");
  const isExcluded = (cardUniqueId?: string) =>
    !!cardUniqueId && (bannedIds.has(cardUniqueId) || livingLegendIds.has(cardUniqueId));
  const source = format === "Silver Age" || format === "Blitz" ? YOUNG_HERO_INFO : HERO_INFO;
  return Object.entries(source)
    .filter(([_, info]) => !isExcluded(info.cardUniqueId))
    .map(([key, info]) => ({
      canonicalKey: key,
      talisharId: toTalisharIdentifier(key),
      displayName: toDisplayName(key),
      className: info.classes[0] ?? "",
    }))
    .sort((a, b) => {
      const cls = a.className.localeCompare(b.className);
      return cls !== 0 ? cls : a.displayName.localeCompare(b.displayName);
    });
}

function classDisplay(c: string): string {
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "";
}

interface MatchupArenaProps {
  deckId: string;
}

export default function MatchupArena({ deckId }: MatchupArenaProps) {
  const { user } = useAuth();
  const [deck, setDeck] = useState<DeckDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<DeckMatchup[]>([]);
  const [results, setResults] = useState<ResultLike[]>([]);
  const [selectedTalisharId, setSelectedTalisharId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialHeroId, setEditorInitialHeroId] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [hoveredCardImage, setHoveredCardImage] = useState<string | null>(null);
  // Card-art fallback for heroes without a stylized portrait (heroPortraits.ts).
  // Young heroes (SA/Blitz) intentionally have no portraits saved — fall back to
  // the actual hero card image, cropped via `object-cover object-top` at render.
  const [heroCardImages, setHeroCardImages] = useState<Map<string, string>>(new Map());

  // Clear hover whenever the selected matchup changes (new card list)
  useEffect(() => {
    setHoveredCardImage(null);
  }, [selectedTalisharId]);

  // Fetch hero card images once we know the format. Used as a fallback in tile
  // rendering whenever a stylized portrait is missing (e.g. all young heroes).
  useEffect(() => {
    if (!deck?.format) return;
    const formatParam =
      deck.format === "Silver Age" || deck.format === "Blitz" ? "young" : "adult";
    let cancelled = false;
    fetch(`/api/hero-printings?format=${formatParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.heroes) return;
        const map = new Map<string, string>();
        for (const h of data.heroes) {
          const tId = toTalisharIdentifier(h.name);
          if (tId && h.image_url) map.set(tId, h.image_url);
        }
        setHeroCardImages(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deck?.format]);

  // Load deck + matchups in parallel — neither depends on the other.
  const [matchupsVersion, setMatchupsVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      decksClient.getDeck(deckId),
      fetch(`/api/decks/${deckId}/matchups`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([deckRes, matchupsRes]) => {
        if (cancelled) return;
        if (deckRes.success) setDeck(deckRes.data);
        else setError(deckRes.error || "Failed to load deck");
        if (matchupsRes?.success) setMatchups(matchupsRes.data?.matchups || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, matchupsVersion]);

  const editable = canEditDeck(deck ?? { userId: null }, user?.id);

  // Load results only when caller can see records (server enforces too)
  useEffect(() => {
    if (!editable) {
      setResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/decks/${deckId}/results?limit=100`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setResults(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deckId, editable]);

  const heroOptions = useMemo(() => getHeroOptionsForFormat(deck?.format), [deck?.format]);
  const strategyOptions = useMemo<HeroOption[]>(
    () =>
      STRATEGY_IDS.map((id) => ({
        canonicalKey: id,
        talisharId: id,
        displayName: getStrategyDisplayName(id),
        className: "Strategies",
      })),
    []
  );
  const allOptions = useMemo(
    () => [...strategyOptions, ...heroOptions],
    [strategyOptions, heroOptions]
  );
  const matchupSet = useMemo(() => new Set(matchups.map((m) => m.heroId)), [matchups]);
  const recordsByHero = useMemo(() => computeMatchupRecords(results), [results]);

  // Insertion order matters — Strategies render first, then class groups.
  const heroByClass = useMemo(() => {
    const grouped: Record<string, HeroOption[]> = { Strategies: strategyOptions };
    for (const h of heroOptions) {
      const k = classDisplay(h.className) || "Other";
      (grouped[k] ||= []).push(h);
    }
    return grouped;
  }, [heroOptions, strategyOptions]);

  const selected = useMemo(
    () => allOptions.find((h) => h.talisharId === selectedTalisharId) ?? null,
    [allOptions, selectedTalisharId]
  );
  const selectedMatchup = useMemo(
    () => matchups.find((m) => m.heroId === selectedTalisharId) ?? null,
    [matchups, selectedTalisharId]
  );
  const selectedRecord: MatchupRecord | null = useMemo(() => {
    if (!selectedTalisharId) return null;
    return recordsByHero[selectedTalisharId.toLowerCase()] ?? null;
  }, [recordsByHero, selectedTalisharId]);

  const coreMatchup = useMemo(() => matchups.find((m) => m.heroId === "core") ?? null, [matchups]);
  const selectedDelta = useMemo(() => {
    if (!selectedMatchup) return null;
    const core = coreMatchup?.sideboard ?? { in: [], out: [] };
    return computeMatchupDelta(core, selectedMatchup.sideboard);
  }, [coreMatchup, selectedMatchup]);

  // Live pitch breakdowns for the post-swap deck and inventory. When no
  // opponent matchup is selected we fall back to the base decklist.
  const breakdown = useMemo(
    () => deck ? computeMatchupBreakdown(deck as any, selectedMatchup?.sideboard) : null,
    [deck, selectedMatchup]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" aria-label="Loading" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-gray-300">{error || "Deck not found"}</p>
        <Link
          href={`/decks/${deckId}`}
          className="text-sm text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          ← Back to deck
        </Link>
      </div>
    );
  }

  const playerHeroPrinting = deck.hero?.[0]?.printingDetails;
  const playerHeroLabel =
    playerHeroPrinting?.display_name ||
    playerHeroPrinting?.name ||
    deck.heroName ||
    "Hero";
  const playerHeroTalisharId = playerHeroPrinting?.name
    ? toTalisharIdentifier(playerHeroPrinting.name)
    : null;
  const playerPortrait =
    getHeroPortraitUrl(playerHeroTalisharId) || playerHeroPrinting?.image_url || null;

  const opponentPortrait = selected
    ? getHeroPortraitUrl(selected.talisharId) || getStrategyPortraitUrl(selected.talisharId)
    : null;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-[1600px] mx-auto px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <Link
            href={`/decks/${deckId}`}
            aria-label="Back to deck"
            className="flex items-center justify-center rounded-md text-gray-300 hover:text-white hover:bg-gray-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <Swords className="h-5 w-5 text-gray-300" aria-hidden="true" />
              <span className="truncate">Matchups</span>
              <span className="text-sm font-normal text-gray-300">·</span>
              <Link
                href={`/decks/${deckId}`}
                className="text-base md:text-lg font-normal text-gray-300 hover:text-white truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                {deck.name}
              </Link>
            </h1>
            <p className="text-sm text-gray-300 mt-0.5 flex items-center gap-2 flex-wrap">
              {deck.format && <span>{deck.format}</span>}
              <span className="text-gray-400" aria-hidden="true">·</span>
              <span>{playerHeroLabel}</span>
            </p>
          </div>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditorInitialHeroId(null);
                setEditorOpen(true);
              }}
              className="focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Settings2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Manage
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-4">
        {/* LEFT: VS strip + sideboard/notes */}
        <div className="min-w-0">
        {/* VS strip — compact: portraits + inline names + footer only when content */}
        <div className="rounded-lg border border-gray-700 bg-gray-950/80 backdrop-blur-md mb-3">
          <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3">
            <HeroSlot displayName={playerHeroLabel} portraitUrl={playerPortrait ?? undefined} side="left" />
            <span className="px-1 md:px-2 text-lg md:text-2xl font-extrabold tracking-widest text-gray-300">
              VS
            </span>
            <HeroSlot
              displayName={selected?.displayName ?? "— pick a hero —"}
              portraitUrl={opponentPortrait ?? undefined}
              empty={!selected}
              side="right"
            />
            {selected && (
              <button
                onClick={() => setSelectedTalisharId(null)}
                aria-label="Clear opponent selection"
                className="ml-1 self-start rounded-md text-gray-300 hover:text-white hover:bg-gray-800 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Footer — record, breakdown chips, and per-matchup Edit button */}
          {(breakdown || (selected && (editable && selectedRecord || !selectedMatchup))) && (
            <div className="border-t border-gray-700 px-3 py-1.5 flex items-center gap-3 text-xs flex-wrap">
              {editable && selectedRecord && (
                <span
                  className="font-bold text-gray-100 inline-flex items-center gap-1"
                  aria-label={`Record: ${selectedRecord.wins} wins, ${selectedRecord.losses} losses`}
                >
                  <span className="text-emerald-400">{selectedRecord.wins}W</span>
                  <span className="text-gray-400" aria-hidden="true">–</span>
                  <span className="text-rose-400">{selectedRecord.losses}L</span>
                </span>
              )}
              {breakdown && <BreakdownChip label="Main"      bd={breakdown.main} />}
              {breakdown && <BreakdownChip label="Inventory" bd={breakdown.inv}  />}
              {selected && !selectedMatchup && (
                <span className="text-gray-300 italic">
                  No notes yet{editable ? " — Edit to add." : "."}
                </span>
              )}
              {editable && selected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditorInitialHeroId(selectedTalisharId);
                    setEditorOpen(true);
                  }}
                  className="ml-auto h-7 px-2 text-xs focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label={selectedMatchup ? `Edit ${selected.displayName} matchup` : `Add ${selected.displayName} matchup`}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  {selectedMatchup ? "Edit" : "Add notes"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Notes + delta panel — only when an opponent with saved data is selected */}
        {selected && selectedMatchup && selectedDelta && (
          <div className="rounded-lg border border-gray-700 bg-gray-950/60 mb-4">
            <button
              onClick={() => setDetailExpanded((v) => !v)}
              aria-expanded={detailExpanded}
              className="w-full flex items-center justify-between px-3 md:px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-900/50 rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span>
                Sideboard delta {detailExpanded ? "▾" : "▸"}
                <span className="ml-2 text-xs font-normal text-gray-300">
                  vs {coreMatchup ? "core plan" : "base decklist"}
                </span>
              </span>
              <span className="text-xs font-normal text-gray-300">
                +{selectedDelta.in.length} in / −{selectedDelta.out.length} out
              </span>
            </button>
            {detailExpanded && (
              <div className="border-t border-gray-700 p-3 md:p-4 space-y-3">
                {selectedMatchup.notes && (
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">
                    {selectedMatchup.notes}
                  </p>
                )}
                <MatchupDeltaView
                  deck={deck}
                  delta={selectedDelta}
                  baselineLabel={coreMatchup ? "core plan" : "base decklist"}
                  onHoverCard={setHoveredCardImage}
                />
              </div>
            )}
          </div>
        )}

        </div>{/* /LEFT */}

        {/* RIGHT: dense hero picker — sticky scroll on lg+, inline on mobile */}
        <aside
          aria-label="Opponent hero picker"
          className="relative lg:sticky lg:top-2 lg:self-start lg:max-h-[calc(100vh-1rem)] rounded-lg border border-gray-700 bg-gray-950/40"
        >
          {/* Card preview overlay — only on lg+. Sits outside the scroll container so it stays pinned in the rail viewport. */}
          {hoveredCardImage && (
            <div
              className="hidden lg:flex pointer-events-none absolute inset-0 z-20 items-center justify-center bg-gray-950/95 rounded-lg p-3"
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hoveredCardImage}
                alt=""
                className="max-w-full max-h-full object-contain rounded-xl border-2 border-gray-600 shadow-2xl"
              />
            </div>
          )}
          <div className="p-2 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto">
          {Object.entries(heroByClass).map(([cls, heroes]) => (
            <div key={cls} className="mb-3 last:mb-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300 px-1 mb-1.5">
                {cls}
              </h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-5 gap-1.5">
                {heroes.map((h) => {
                  const has = matchupSet.has(h.talisharId);
                  const stylizedPortrait =
                    getHeroPortraitUrl(h.talisharId) || getStrategyPortraitUrl(h.talisharId);
                  const cardArt = !stylizedPortrait ? heroCardImages.get(h.talisharId) ?? null : null;
                  const portrait = stylizedPortrait || cardArt;
                  const isSelected = h.talisharId === selectedTalisharId;
                  // Strategies are archetypes, not opponents — no W/L records to show.
                  const record =
                    editable && !isStrategyId(h.talisharId)
                      ? recordsByHero[h.talisharId.toLowerCase()]
                      : null;
                  return (
                    <button
                      key={h.talisharId}
                      onClick={() => setSelectedTalisharId(h.talisharId)}
                      aria-pressed={isSelected}
                      aria-label={`Select ${h.displayName}${has ? " (has matchup notes)" : " (no notes)"}${record ? ` — ${record.wins} wins, ${record.losses} losses` : ""}`}
                      title={h.displayName}
                      className={
                        "relative group aspect-[3/4] rounded overflow-hidden border-2 transition-all " +
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 " +
                        (isSelected
                          ? "border-blue-400 ring-2 ring-blue-400 shadow-md shadow-blue-500/30 scale-[1.03]"
                          : has
                            ? "border-gray-600 hover:border-gray-400"
                            : "border-dashed border-gray-700 hover:border-gray-500")
                      }
                    >
                      {portrait ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={portrait}
                          alt=""
                          width={120}
                          height={160}
                          loading="lazy"
                          decoding="async"
                          className={
                            "w-full h-full object-cover object-top " +
                            // Card-art fallbacks: zoom + top-anchor so the character
                            // art fills the tile rather than the full card + text box.
                            (cardArt ? "scale-[1.45] origin-top " : "") +
                            (has ? "" : "grayscale brightness-75")
                          }
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-gray-300 px-1 text-center">
                          {h.displayName.split(",")[0]}
                        </div>
                      )}
                      {/* Bottom-overlay name + status */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1 pt-3 pb-1">
                        <p className="text-xs font-bold text-white truncate text-left leading-tight">
                          {h.displayName.split(",")[0]}
                        </p>
                        {record ? (
                          <p className="text-xs font-bold text-gray-100 leading-tight">
                            <span className="text-emerald-300">{record.wins}</span>
                            <span className="text-gray-300" aria-hidden="true">–</span>
                            <span className="text-rose-300">{record.losses}</span>
                          </p>
                        ) : has ? (
                          <p className="text-xs text-gray-200 leading-tight">✓ notes</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>{/* /scroll wrapper */}
        </aside>
        </div>{/* /grid */}
      </div>

      {/* Editor modal — reuses existing dialog. */}
      {editable && (
        <DeckMatchupsDialog
          open={editorOpen}
          onOpenChange={(v) => {
            setEditorOpen(v);
            if (!v) {
              setMatchupsVersion((n) => n + 1);
              setEditorInitialHeroId(null);
            }
          }}
          deckId={deckId}
          deck={deck as any}
          initialEditHeroId={editorInitialHeroId}
          heroCardImages={heroCardImages}
        />
      )}
    </div>
  );
}

function HeroSlot({
  displayName,
  portraitUrl,
  empty,
  side,
}: {
  displayName: string;
  portraitUrl?: string;
  empty?: boolean;
  side: "left" | "right";
}) {
  const portraitEl = (
    <div
      className={
        "w-14 h-20 md:w-16 md:h-24 shrink-0 rounded-md overflow-hidden border-2 " +
        (empty
          ? "border-dashed border-gray-600 bg-gray-900 flex items-center justify-center"
          : "border-gray-600 bg-gray-900")
      }
    >
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitUrl}
          alt={displayName}
          width={120}
          height={160}
          decoding="async"
          fetchPriority={side === "left" ? "high" : "auto"}
          className="w-full h-full object-cover object-top"
        />
      ) : empty ? (
        <Swords className="h-5 w-5 text-gray-400" aria-hidden="true" />
      ) : null}
    </div>
  );
  const [primary, ...rest] = displayName.split(",");
  const subtitle = rest.join(",").trim();
  const nameEl = (
    <div className={"min-w-0 flex-1 " + (side === "left" ? "text-right" : "text-left")}>
      <p className="text-sm md:text-base font-bold text-gray-100 truncate" title={displayName}>
        {primary}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-300 truncate" title={displayName}>
          {subtitle}
        </p>
      )}
    </div>
  );
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {side === "left" ? <>{nameEl}{portraitEl}</> : <>{portraitEl}{nameEl}</>}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { decksClient } from "@/lib/client";
import { collectUniqueCards } from "@/lib/deck/unique-cards";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";

const MAX = 10000;
const MAX_CARD = 280;

const PITCH_BADGE: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-yellow-400 text-gray-900",
  3: "bg-blue-500 text-white",
};

function titleCase(slug: string): string {
  return slug.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Owner/co-owner-only deck notes: a free-text game plan + one short note per
 * unique card. Stored privately in deck.metadata (gamePlan + cardNotes) and
 * surfaced to the get_results MCP coaching. v1 — iterate on layout.
 */
export default function DeckNotesTab({ deckId, deck }: { deckId: string; deck?: DeckDTO }) {
  const [notes, setNotes] = useState("");
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});
  const [matchupNotes, setMatchupNotes] = useState<Record<string, string>>({});
  const [facedHeroes, setFacedHeroes] = useState<string[]>([]);
  const [selectedHero, setSelectedHero] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    decksClient.getDeckNotes(deckId)
      .then((d) => {
        if (d.success) {
          setNotes(d.data?.notes ?? "");
          setCardNotes(d.data?.cardNotes ?? {});
          setMatchupNotes(d.data?.matchupNotes ?? {});
        } else setError(d.error ?? "Failed to load notes");
      })
      .catch(() => setError("Failed to load notes"))
      .finally(() => setLoaded(true));
  }, [deckId]);

  // Opponents you've actually faced (for the matchup-notes hero list).
  useEffect(() => {
    decksClient.getDeckResults(deckId, { limit: 100 })
      .then((d) => {
        if (d.success && Array.isArray(d.data.games)) {
          const set = new Set<string>();
          for (const g of d.data.games) if (g?.opponentHero) set.add(g.opponentHero);
          setFacedHeroes([...set]);
        }
      })
      .catch(() => {});
  }, [deckId]);

  // Every unique card across the deck — maindeck, equipment, hero, and the
  // inventory (sideboard pool) — deduped by name+pitch.
  const uniqueCards = useMemo(() => collectUniqueCards(deck), [deck]);

  // Heroes to show in the matchup sidebar: faced opponents + any already noted.
  const matchupHeroes = useMemo(() => {
    const set = new Set<string>([...facedHeroes, ...Object.keys(matchupNotes)]);
    return [...set].filter(Boolean).sort((a, b) => titleCase(a).localeCompare(titleCase(b)));
  }, [facedHeroes, matchupNotes]);

  useEffect(() => {
    if (!selectedHero && matchupHeroes.length) setSelectedHero(matchupHeroes[0]);
  }, [matchupHeroes, selectedHero]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const d = await decksClient.saveDeckNotes(deckId, { notes, cardNotes, matchupNotes });
      if (!d.success) throw new Error(d.error ?? "Save failed");
      // reflect server sanitization
      if (d.data?.cardNotes) setCardNotes(d.data.cardNotes);
      if (d.data?.matchupNotes) setMatchupNotes(d.data.matchupNotes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game plan */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Game Plan Notes</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Private to you and co-owners. How you want to pilot this deck — game plan, mulligan, key turns, matchups.
            Your AI game analysis (Results) reads this to coach against your stated plan.
          </p>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, MAX))}
          rows={12}
          placeholder={
            "e.g. Game plan: block down base equipment, bank evos, threaten Singularity ~turn 9–11.\n" +
            "Vs Kassai: don't block her weapons with attack actions; race the gold engine."
          }
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        />
        <div className="text-xs text-gray-400 tabular-nums">{notes.length}/{MAX}</div>
      </div>

      {/* Per-card notes */}
      {uniqueCards.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Card Notes</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              One short note per unique card (not per copy) — e.g. when to hold it, what to block, what it answers.
            </p>
          </div>
          <div className="space-y-1.5">
            {uniqueCards.map((c) => (
              <div key={c.key} className="flex items-center gap-2">
                <span className="flex w-44 shrink-0 items-center gap-1.5 truncate text-sm text-gray-700 dark:text-gray-300" title={c.name}>
                  {c.pitch > 0 && (
                    <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", PITCH_BADGE[c.pitch])}>
                      {c.pitch}
                    </span>
                  )}
                  <span className="truncate">{c.name}</span>
                </span>
                <input
                  type="text"
                  value={cardNotes[c.key] ?? ""}
                  maxLength={MAX_CARD}
                  onChange={(e) => setCardNotes((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  placeholder="short note…"
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matchup notes — per opponent hero (sideboard / matchup context) */}
      {matchupHeroes.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Matchup Notes</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Per-opponent context — pick a hero, write your sideboard / matchup plan. Surfaced when you analyze that matchup.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="w-44 shrink-0 max-h-72 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {matchupHeroes.map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHero(h)}
                  className={cn(
                    "flex w-full items-center justify-between gap-1 px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    selectedHero === h
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  )}
                >
                  <span className="truncate">{titleCase(h)}</span>
                  {matchupNotes[h]?.trim() && <span className="shrink-0 text-blue-500" title="has notes">●</span>}
                </button>
              ))}
            </div>
            <div className="flex-1">
              {selectedHero ? (
                <textarea
                  value={matchupNotes[selectedHero] ?? ""}
                  onChange={(e) => setMatchupNotes((prev) => ({ ...prev, [selectedHero]: e.target.value }))}
                  rows={8}
                  placeholder={`Plan vs ${titleCase(selectedHero)} — sideboard swaps, what to block, how this matchup is won or lost…`}
                  className="w-full min-h-[8rem] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              ) : (
                <p className="text-sm text-gray-400">Select a hero to add matchup notes.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save notes"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}

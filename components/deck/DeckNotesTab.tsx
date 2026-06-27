"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save, Check } from "lucide-react";

const MAX = 10000;

/**
 * Owner/co-owner-only game-plan notes for a deck. Free-text v1 — how the player
 * intends to pilot the deck (game plan, mulligan, matchup notes). Stored in
 * deck.metadata.gamePlan and surfaced to the get_results MCP coaching so the
 * analysis is judged against the player's stated intent. Never shown publicly.
 */
export default function DeckNotesTab({ deckId }: { deckId: string }) {
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/decks/${deckId}/notes`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setNotes(d.data?.notes ?? "");
        else setError(d.error ?? "Failed to load notes");
      })
      .catch(() => setError("Failed to load notes"))
      .finally(() => setLoaded(true));
  }, [deckId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/decks/${deckId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error ?? "Save failed");
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
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Game Plan Notes</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Private to you and co-owners. How you want to pilot this deck — game plan, mulligan, key turns, matchup
          notes. Your AI game analysis (Results) reads this to coach against your stated plan.
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, MAX))}
        rows={16}
        placeholder={
          "e.g. Game plan: block down base equipment, bank evos, threaten Singularity around turn 9–11.\n" +
          "Mulligan: keep a hand that equips 1–2 evos.\n" +
          "Vs Kassai: don't block her weapons with attack actions; race the gold engine."
        }
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save notes"}
        </button>
        <span className="text-xs text-gray-400 tabular-nums">{notes.length}/{MAX}</span>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}

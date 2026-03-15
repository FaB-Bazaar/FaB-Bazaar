"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameResultDTO } from "@/lib/services/postgres/gameResults/PostgresGameResultsService";

interface Props {
  deckId: string;
}

export default function DeckResultsTab({ deckId }: Props) {
  const [results, setResults] = useState<GameResultDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-6 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Games</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{wins}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Wins</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 dark:text-red-400">{losses}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Losses</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{winRate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Win Rate</div>
        </div>
      </div>

      {/* Game list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {results.map(r => (
          <div key={r.id} className="flex items-center gap-3 py-2.5 px-1">
            <span className={cn(
              "shrink-0 w-10 text-center text-xs font-bold px-2 py-1 rounded-full",
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
                {r.conceded && (
                  <span className="text-xs text-gray-400">(conceded)</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {r.format && <span>{r.format}</span>}
                {r.totalTurns != null && <span>{r.totalTurns} turns</span>}
                {r.firstPlayer != null && (
                  <span>{r.firstPlayer ? "went first" : "went second"}</span>
                )}
              </div>
            </div>

            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {new Date(r.playedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

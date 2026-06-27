"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Lightbulb } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import type { GameAnalysis, PlayerAnalysis } from "@/lib/talishar/analyzeGame";

interface Props {
  deckId: string; // public id (route param)
  resultId: string;
  playerHeroName?: string;
  opponentHeroName?: string;
}

const YOU = "#3b82f6"; // blue-500
const OPP = "#f97316"; // orange-500
const DEALT = "#22c55e"; // green-500
const TAKEN = "#ef4444"; // red-500
const AXIS = "#9ca3af"; // gray-400 — legible in both themes

function heroLabel(name?: string): string {
  if (!name) return "—";
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── Small presentational helpers ────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">
      {children}
    </p>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="flex-1 min-w-[120px] rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn("text-xl font-bold text-gray-900 dark:text-white", accent)}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// Horizontal labelled bars (for equipment / engine / pitched counts)
function BarList({
  rows,
  unit,
  color,
}: {
  rows: Array<{ key: string; label: string; value: number }>;
  unit: string;
  color: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-40 shrink-0 truncate text-xs text-gray-700 dark:text-gray-300" title={r.label}>
            {r.label}
          </span>
          <div className="flex-1 h-4 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-600 dark:text-gray-400">
            {r.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Per-player sections (driven by the You/Opp toggle) ──────────────────────

function PlayerPanel({ p }: { p: PlayerAnalysis }) {
  const tempo = p.perTurn.map((t) => ({ turn: `T${t.turn}`, Dealt: t.dealt, Taken: t.taken }));
  const topCards = [...p.cards].sort((a, b) => b.played - a.played).slice(0, 12);

  return (
    <div className="space-y-5">
      {/* Efficiency + headline numbers */}
      <div className="flex flex-wrap gap-2">
        <StatCard
          label="Damage dealt / threatened"
          value={`${p.efficiency.dealt}/${p.efficiency.threatened}`}
          sub={`${p.efficiency.pct}% of threatened landed`}
          accent={p.efficiency.pct < 60 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}
        />
        <StatCard label="Damage blocked" value={p.totals.damageBlocked} accent="text-blue-600 dark:text-blue-400" />
        <StatCard label="Avg value / turn" value={p.totals.avgValuePerTurn} />
        <StatCard label="Avg dealt / turn" value={p.totals.avgDamageDealtPerTurn} />
      </div>

      {/* Per-turn tempo */}
      <div>
        <SectionTitle>Per-turn tempo (dealt vs taken)</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={tempo} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS} strokeOpacity={0.2} vertical={false} />
            <XAxis dataKey="turn" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip cursor={{ fill: AXIS, fillOpacity: 0.1 }} />
            <Bar dataKey="Dealt" fill={DEALT} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Taken" fill={TAKEN} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Equipment blocks */}
      {p.equipment.length > 0 && (
        <div>
          <SectionTitle>Equipment / arena blocks</SectionTitle>
          <BarList
            unit="blk"
            color={YOU}
            rows={p.equipment.map((e) => ({ key: e.cardId, label: e.name || e.cardId, value: e.blocked }))}
          />
        </div>
      )}

      {/* Activation engine */}
      {p.engine.length > 0 && (
        <div>
          <SectionTitle>Activations</SectionTitle>
          <BarList
            unit="×"
            color="#a855f7"
            rows={p.engine.map((e) => ({ key: e.cardId, label: e.name || e.cardId, value: e.activated }))}
          />
        </div>
      )}

      {/* Card performance */}
      {topCards.length > 0 && (
        <div>
          <SectionTitle>Card performance</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-1 pr-2 font-medium">Card</th>
                  <th className="text-center py-1 px-2 font-medium">Played</th>
                  <th className="text-center py-1 px-2 font-medium">Hit %</th>
                  <th className="text-center py-1 px-2 font-medium">Blocked</th>
                  <th className="text-center py-1 px-2 font-medium">Pitched</th>
                  <th className="text-left py-1 pl-2 font-medium">Notable</th>
                </tr>
              </thead>
              <tbody>
                {topCards.map((c) => (
                  <tr key={`${c.cardId}-${c.pitchValue}`} className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                    <td className="py-1 pr-2 truncate max-w-[180px]" title={c.name}>{c.name || c.cardId}</td>
                    <td className="text-center py-1 px-2 tabular-nums">{c.played || "—"}</td>
                    <td className={cn("text-center py-1 px-2 tabular-nums", c.hitPct != null && c.hitPct >= 50 && "text-green-600 dark:text-green-400")}>
                      {c.hitPct != null ? `${c.hitPct}%` : "—"}
                    </td>
                    <td className="text-center py-1 px-2 tabular-nums">{c.blocked || "—"}</td>
                    <td className="text-center py-1 px-2 tabular-nums">{c.pitched || "—"}</td>
                    <td className="py-1 pl-2 text-gray-500 dark:text-gray-400">
                      {Object.entries(c.extra).map(([k, v]) => `${k} ×${v}`).join(", ") || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function GameDeepDive({ deckId, resultId, playerHeroName, opponentHeroName }: Props) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [side, setSide] = useState<"you" | "opp">("you");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deckId}/results/${resultId}/raw`)
      .then((r) => r.json())
      .then((res: { success: boolean; data: GameAnalysis | null }) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setAnalysis(res.data);
          setState("ready");
        } else {
          setState("empty");
        }
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [deckId, resultId]);

  if (state === "empty") return null; // no archive for this game — show nothing
  if (state === "loading")
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading deep dive…
      </div>
    );
  if (state === "error" || !analysis)
    return <p className="text-xs text-gray-400 py-3">Couldn&apos;t load the deep dive.</p>;

  const youLabel = heroLabel(playerHeroName ?? analysis.you.hero);
  const oppLabel = heroLabel(opponentHeroName ?? analysis.opponent?.hero);
  const lifeData = analysis.lifeRace.map((l) => ({ turn: `T${l.turn}`, [youLabel]: l.you, [oppLabel]: l.opp }));
  const active = side === "you" ? analysis.you : analysis.opponent;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-5">
      <p className="text-xs font-bold tracking-widest text-blue-600 dark:text-blue-300 uppercase">Game Deep Dive</p>

      {/* Auto insights */}
      {analysis.insights.length > 0 && (
        <ul className="space-y-1">
          {analysis.insights.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Life race — both players */}
      <div>
        <SectionTitle>Life total race</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lifeData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS} strokeOpacity={0.2} />
            <XAxis dataKey="turn" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis domain={[0, "dataMax"]} tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip cursor={{ stroke: AXIS, strokeOpacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey={youLabel} stroke={YOU} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey={oppLabel} stroke={OPP} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* You / Opponent toggle for per-player sections */}
      {analysis.opponent && (
        <div className="flex gap-1.5">
          {(["you", "opp"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                side === s
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {side === s ? "✓ " : ""}{s === "you" ? youLabel : oppLabel}
            </button>
          ))}
        </div>
      )}

      {active ? <PlayerPanel p={active} /> : <p className="text-xs text-gray-400">No data for this side.</p>}
    </div>
  );
}

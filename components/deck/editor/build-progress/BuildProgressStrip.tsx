"use client";

import React from "react";
import { Sword, Shield, Sparkles, Wrench, X } from "lucide-react";
import BuildProgressStep from "./BuildProgressStep";
import type { BuildProgress, BuildStepKey } from "@/lib/deck-builder/build-progress";

interface BuildProgressStripProps {
  deckName: string;
  progress: BuildProgress;
  onStepClick?: (step: BuildStepKey) => void;
  onDismiss?: () => void;
}

const STEP_ORDER: Array<{
  key: BuildStepKey;
  label: string;
  icon: typeof Sword;
  accent: "amber" | "red" | "blue" | "violet";
}> = [
  { key: "gear", label: "Gear", icon: Wrench, accent: "amber" },
  { key: "attacks", label: "Attacks", icon: Sword, accent: "red" },
  { key: "defense", label: "Defense", icon: Shield, accent: "blue" },
  { key: "utility", label: "Utility", icon: Sparkles, accent: "violet" },
];

export default function BuildProgressStrip({
  deckName,
  progress,
  onStepClick,
  onDismiss,
}: BuildProgressStripProps) {
  return (
    <section
      aria-label="Deck build progress"
      className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900/80 dark:to-gray-900/40 p-4 backdrop-blur-md"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Building{" "}
            <span className="text-blue-700 dark:text-blue-300">{deckName}</span>
          </h2>
          {progress.overallComplete && (
            <span className="rounded-full border border-green-500/50 bg-green-100 dark:bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">
              Ready to tune
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">
            {progress.totalCards.current} / {progress.totalCards.target} cards
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss build progress"
              className="rounded-md p-1 text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STEP_ORDER.map(({ key, label, icon, accent }) => (
          <BuildProgressStep
            key={key}
            label={label}
            icon={icon}
            accent={accent}
            current={progress.steps[key].current}
            target={progress.steps[key].target}
            complete={progress.steps[key].complete}
            onClick={onStepClick ? () => onStepClick(key) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

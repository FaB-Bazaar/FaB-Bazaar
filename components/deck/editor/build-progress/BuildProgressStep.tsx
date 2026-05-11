"use client";

import React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildProgressStepProps {
  label: string;
  icon: LucideIcon;
  current: number;
  target: number;
  complete: boolean;
  accent: "amber" | "red" | "blue" | "violet";
  onClick?: () => void;
}

const ACCENT_BORDER: Record<BuildProgressStepProps["accent"], string> = {
  amber: "border-amber-500/40 hover:border-amber-400",
  red: "border-red-500/40 hover:border-red-400",
  blue: "border-blue-500/40 hover:border-blue-400",
  violet: "border-violet-500/40 hover:border-violet-400",
};

const ACCENT_FILL: Record<BuildProgressStepProps["accent"], string> = {
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export default function BuildProgressStep({
  label,
  icon: Icon,
  current,
  target,
  complete,
  accent,
  onClick,
}: BuildProgressStepProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      data-complete={complete ? "true" : "false"}
      aria-label={`${label} — ${current} of ${target}${complete ? ", complete" : ""}`}
      className={cn(
        "group flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors",
        "bg-gray-900/60 backdrop-blur-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        ACCENT_BORDER[accent],
        complete && "border-t-[3px]"
      )}
    >
      <div className="flex w-full items-center gap-2">
        <Icon className="h-4 w-4 text-gray-300" />
        <span className="text-sm font-semibold text-gray-200">{label}</span>
        {complete && (
          <Check className="ml-auto h-4 w-4 text-green-400" aria-hidden="true" />
        )}
      </div>

      <div className="flex w-full items-center gap-2">
        <span className="text-base font-bold tabular-nums text-gray-100">
          {current} / {target}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div className={cn("h-full transition-all", ACCENT_FILL[accent])} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

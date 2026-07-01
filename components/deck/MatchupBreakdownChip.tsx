"use client";

import React from "react";
import { Shield } from "lucide-react";

export interface Breakdown {
  red: number;
  yellow: number;
  blue: number;
  equipment: number;
  hero: number;
  other: number;
  library: number;
  total: number;
}

export const EMPTY_BREAKDOWN: Breakdown = {
  red: 0, yellow: 0, blue: 0, equipment: 0, hero: 0, other: 0, library: 0, total: 0,
};

export function BreakdownChip({ label, bd }: { label: string; bd: Breakdown }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-300 border border-gray-300 dark:border-gray-700 rounded h-4 px-1.5">
      <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      <span className="text-gray-500" aria-hidden="true">·</span>
      <span className="font-bold text-gray-700 dark:text-gray-200">{bd.total}</span>
      <span className="text-gray-500" aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
        <span>{bd.red}</span>
      </span>
      <span className="inline-flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" aria-hidden="true" />
        <span>{bd.yellow}</span>
      </span>
      <span className="inline-flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
        <span>{bd.blue}</span>
      </span>
      {bd.equipment > 0 && (
        <span
          className="inline-flex items-center gap-0.5 text-gray-500 dark:text-gray-400"
          aria-label={`${bd.equipment} equipment`}
        >
          <Shield className="h-2.5 w-2.5" aria-hidden="true" />
          <span>{bd.equipment}</span>
        </span>
      )}
      {bd.other > 0 && (
        <span className="text-gray-500 dark:text-gray-400">{bd.other}*</span>
      )}
    </span>
  );
}

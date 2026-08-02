// lib/binder/set-binder.ts
// Helpers for the "add a whole set to a new binder" feature on /sets/[setCode].

import { displayUsername } from '@/lib/utils/display-username';

/** Canonical binder name for a user's set binder: "{username} - {SETCODE}". */
export function buildSetBinderName(username: string, setCode: string): string {
  return `${displayUsername(username)} - ${setCode.toUpperCase()}`;
}

export interface SetBinderPrinting {
  printing_id: string;
  collector_number: string;
  foiling: string;
  art_variations: string[];
}

/**
 * One printing per (collector_number, foiling), preferring the regular
 * printing over art variants. Preserves input order of first appearance.
 */
export function dedupeSetPrintings(printings: SetBinderPrinting[]): SetBinderPrinting[] {
  const byKey = new Map<string, SetBinderPrinting>();
  for (const p of printings) {
    const key = `${p.collector_number}|${p.foiling}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
    } else if (existing.art_variations.length > 0 && p.art_variations.length === 0) {
      byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

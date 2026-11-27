"use client";

import { ChevronDown } from "lucide-react";
import type { DeckVersionSummary } from "@/lib/deck/deck-versions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TalisharMark from "./TalisharMark";

// The list Talishar imports for this deck (decks.talishar_version): the deck as
// it is now, or one saved version. A setting of its own — the version picker
// beside it only changes what this page shows.
export default function TalisharVersionPicker({ versions, talisharVersion, hidden, onChange }: {
  /** null while the list loads. */
  versions: DeckVersionSummary[] | null;
  /** The chosen version number; null = the deck itself. */
  talisharVersion: number | null;
  /** The deck is hidden from Talishar (Options → Settings), so nothing is imported. */
  hidden: boolean;
  onChange: (versionNumber: number | null) => void;
}) {
  if (hidden) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400" title="Turn it on in Options → Settings">
        <TalisharMark className="h-4 w-4 opacity-50" />
        Hidden from Talishar
      </span>
    );
  }

  const chosen = talisharVersion != null ? versions?.find(v => v.versionNumber === talisharVersion) : undefined;
  const label = talisharVersion == null ? "Current deck" : `Version ${talisharVersion}${chosen?.label ? ` — ${chosen.label}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Talishar plays: ${label}`}
          className="inline-flex max-w-72 shrink-0 items-center gap-1.5 rounded-sm border border-gray-400 bg-gray-100 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <TalisharMark />
          <span className="text-gray-600 dark:text-gray-400">Talishar:</span>
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Talishar plays"
        align="start"
        className="max-h-[min(26rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
      >
        <DropdownMenuLabel className="py-1 text-xs font-normal text-gray-700 dark:text-gray-300">
          The list Talishar imports when you play this deck there.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={talisharVersion == null ? "current" : String(talisharVersion)}
          onValueChange={value => onChange(value === "current" ? null : Number(value))}
        >
          <DropdownMenuRadioItem value="current" className="items-start">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">Current deck</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">Follows your edits</span>
            </span>
          </DropdownMenuRadioItem>
          {(versions ?? []).map(v => (
            <DropdownMenuRadioItem key={v.versionNumber} value={String(v.versionNumber)} className="items-start">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">Version {v.versionNumber}{v.label ? ` — ${v.label}` : ""}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Stays the same while you edit</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {versions === null && (
          <p className="px-2 py-1.5 pl-8 text-xs text-gray-600 dark:text-gray-400">Loading versions…</p>
        )}
        {versions && versions.length === 0 && (
          <p className="px-2 py-1.5 pl-8 text-xs text-gray-600 dark:text-gray-400">Save a version to pin it for Talishar.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

// The picker right after the deck's name (editors): which list is showing —
// the deck itself or one of its saved versions. The app's own menu rather
// than a native <select>, whose popup is drawn by the OS and ignores the
// site's theme.

import { ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeckVersionSummary } from "@/lib/deck/deck-versions";
import { cn } from "@/lib/utils";
import TalisharMark from "./TalisharMark";

const savedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function VersionPicker({ versions, openVersion, talisharVersion, onCurrent, onOpen, onSave }: {
  /** null while the list loads. */
  versions: DeckVersionSummary[] | null;
  /** The version the page is showing; null = the deck itself. */
  openVersion: number | null;
  /** The list Talishar imports — a version number, or null for the deck itself. undefined = the deck is hidden from Talishar (no coin anywhere). */
  talisharVersion?: number | null;
  onCurrent: () => void;
  onOpen: (versionNumber: number) => void;
  onSave: () => void;
}) {
  const open = openVersion != null ? versions?.find(v => v.versionNumber === openVersion) : undefined;
  const current = openVersion == null;
  const triggerText = current ? "Current deck" : `Version ${openVersion}${open?.label ? ` — ${open.label}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Deck version: ${triggerText}`}
          className={cn(
            "inline-flex max-w-72 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            current
              ? "border-gray-400 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              : "border-blue-600 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900",
          )}
        >
          {talisharVersion !== undefined && talisharVersion === openVersion && <TalisharMark />}
          <span className="truncate">{triggerText}</span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="Deck version"
        align="start"
        className="max-h-[min(26rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
      >
        <DropdownMenuRadioGroup
          value={current ? "current" : String(openVersion)}
          onValueChange={value => (value === "current" ? onCurrent() : onOpen(Number(value)))}
        >
          <DropdownMenuRadioItem value="current" className="items-start">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">Current deck</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">The deck as it is now</span>
            </span>
            {talisharVersion === null && <TalisharMark className="mt-0.5 h-4 w-4" />}
          </DropdownMenuRadioItem>
          {versions && versions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Saved versions</DropdownMenuLabel>
            </>
          )}
          {(versions ?? []).map(v => (
            <DropdownMenuRadioItem key={v.versionNumber} value={String(v.versionNumber)} className="items-start">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-medium tabular-nums">Version {v.versionNumber}</span>
                  {v.label && <span className="truncate">{v.label}</span>}
                </span>
                <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                  {savedOn(v.createdAt)} · {v.counts.maindeck} deck · {v.counts.inventory} sideboard
                </span>
              </span>
              {talisharVersion === v.versionNumber && <TalisharMark className="mt-0.5 h-4 w-4" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {versions === null && (
          <p className="px-2 py-1.5 pl-8 text-xs text-gray-600 dark:text-gray-400">Loading versions…</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSave}>
          <Plus aria-hidden />
          Save a version…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

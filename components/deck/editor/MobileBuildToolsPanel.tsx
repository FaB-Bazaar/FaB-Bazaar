"use client";

import React from "react";

export type OwnershipFilter = "all" | "owned" | "unowned";
export type AddCategory = "maindeck" | "inventory" | "benched";
export type PitchColor = "red" | "yellow" | "blue";

export interface MobileBuildToolsPanelProps {
  modKey: string;
  ownershipFilter: OwnershipFilter;
  onClose: () => void;
  onScrollToTop: () => void;
  onScrollToSection: (color: PitchColor) => void;
  onAddCards: (category: AddCategory) => void;
  onOwnershipFilter: (filter: OwnershipFilter) => void;
  /** Hide the Add Cards group for viewers who can't edit the deck (default true) */
  canAddCards?: boolean;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950";

const buildBtn =
  `flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-3 text-base font-semibold text-gray-100 hover:bg-gray-700 active:bg-gray-600 transition-colors ${focusRing}`;

const navBtn =
  `flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/50 px-2 py-2.5 text-base text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors ${focusRing}`;

const segBtnBase =
  `flex-1 px-2 py-2 text-base font-medium transition-colors ${focusRing}`;

export default function MobileBuildToolsPanel({
  modKey,
  ownershipFilter,
  onClose,
  onScrollToTop,
  onScrollToSection,
  onAddCards,
  onOwnershipFilter,
  canAddCards = true,
}: MobileBuildToolsPanelProps) {
  const segActive = (active: boolean) =>
    active
      ? "bg-blue-600 text-white"
      : "bg-gray-800/60 text-gray-300 hover:bg-gray-700";

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-200 font-sans font-bold text-xs border border-gray-600">
            {modKey}K
          </kbd>
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Build Tools
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Build Tools"
          className={`text-base text-gray-300 hover:text-white px-2 py-1 rounded ${focusRing}`}
        >
          ✕ Close
        </button>
      </div>

      {/* Add Cards — hidden on decks the viewer can't edit */}
      {canAddCards && <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Add Cards
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="Add to Maindeck"
            onClick={() => onAddCards("maindeck")}
            className={buildBtn}
          >
            + Maindeck
          </button>
          <button
            type="button"
            aria-label="Add to Inventory"
            onClick={() => onAddCards("inventory")}
            className={buildBtn}
          >
            + Inventory
          </button>
          <button
            type="button"
            aria-label="Add to Bench"
            onClick={() => onAddCards("benched")}
            className={buildBtn}
          >
            + Bench
          </button>
        </div>
      </div>}

      {/* Jump To */}
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Jump To
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            aria-label="Scroll to top"
            onClick={onScrollToTop}
            className={navBtn}
          >
            ↑ Top
          </button>
          <button
            type="button"
            aria-label="Jump to Red section"
            onClick={() => onScrollToSection("red")}
            className={navBtn}
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-red-400">Red</span>
          </button>
          <button
            type="button"
            aria-label="Jump to Yellow section"
            onClick={() => onScrollToSection("yellow")}
            className={navBtn}
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-yellow-300">Yellow</span>
          </button>
          <button
            type="button"
            aria-label="Jump to Blue section"
            onClick={() => onScrollToSection("blue")}
            className={navBtn}
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-blue-400">Blue</span>
          </button>
        </div>
      </div>

      {/* Ownership filter — tri-state segmented */}
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Show
        </div>
        <div
          role="group"
          aria-label="Ownership filter"
          className="flex rounded-lg overflow-hidden border border-gray-700"
        >
          <button
            type="button"
            aria-label="Show all cards"
            aria-pressed={ownershipFilter === "all"}
            onClick={() => onOwnershipFilter("all")}
            className={`${segBtnBase} ${segActive(ownershipFilter === "all")}`}
          >
            {ownershipFilter === "all" && (
              <span aria-hidden="true" className="mr-1">
                ✓
              </span>
            )}
            All
          </button>
          <button
            type="button"
            aria-label="Owned only"
            aria-pressed={ownershipFilter === "owned"}
            onClick={() => onOwnershipFilter("owned")}
            className={`${segBtnBase} border-l border-gray-700 ${segActive(ownershipFilter === "owned")}`}
          >
            {ownershipFilter === "owned" && (
              <span aria-hidden="true" className="mr-1">
                ✓
              </span>
            )}
            Owned
          </button>
          <button
            type="button"
            aria-label="Unowned only"
            aria-pressed={ownershipFilter === "unowned"}
            onClick={() => onOwnershipFilter("unowned")}
            className={`${segBtnBase} border-l border-gray-700 ${segActive(ownershipFilter === "unowned")}`}
          >
            {ownershipFilter === "unowned" && (
              <span aria-hidden="true" className="mr-1">
                ✓
              </span>
            )}
            Unowned
          </button>
        </div>
      </div>

    </div>
  );
}

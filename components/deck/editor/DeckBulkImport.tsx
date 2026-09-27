"use client";

// Paste-a-decklist import (the deck page's "Add Cards" tab, desktop): the list
// form (collapses to "N results — click to search again"), search errors, the
// "some cards weren't imported" notice, Stage All / Clear, and the results grid
// to pick printings/quantities and stage. Saving the staged cards is the
// page's job (classic: DeckEditorSidebar; v2: a save bar). Moved verbatim from
// the classic deck page so deck v2 shares it.

import React from "react";
import { AlertCircle, Search, X } from "lucide-react";
import BulkImportForm from "@/components/browse/BulkImportForm";
import BulkResultsGrid from "@/components/browse/BulkResultsGrid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { useDeckEditor } from "@/hooks/deck/useDeckEditor";

type Editor = ReturnType<typeof useDeckEditor>;

export default function DeckBulkImport({ state, handlers, onSearch, searchFormOpen, setSearchFormOpen, onPrintingView }: {
  state: Editor["state"];
  handlers: Editor["handlers"];
  onSearch: (e: React.FormEvent) => void | Promise<void>;
  searchFormOpen: boolean;
  setSearchFormOpen: (open: boolean) => void;
  /** Open the printing picker for a result row (by instance id). */
  onPrintingView: (instanceId: string) => void;
}) {
  const handleSearch = onSearch;
  return (
    <>
    {searchFormOpen ? (
      <BulkImportForm
        bulkInput={state.bulkInput}
        onInputChange={handlers.setBulkInput}
        onSearch={handleSearch}
        loading={state.loading}
      />
    ) : (
      <div
        onClick={() => setSearchFormOpen(true)}
        className="flex items-center gap-3 mb-6 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">
          {state.bulkResults.length} result{state.bulkResults.length !== 1 ? "s" : ""} — click to search again
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handlers.clearBulkResults(); setSearchFormOpen(true); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    )}

    {state.error && (
      <Alert variant="destructive" className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Search Failed</AlertTitle>
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )}

    {state.excludedBulkCards.length > 0 && !state.loading && (() => {
      const titleCase = (s: string) =>
        s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return (
      <Alert className="mb-4 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="flex items-center justify-between gap-2">
          <span>Some cards weren't imported</span>
          <button
            type="button"
            onClick={handlers.dismissExcludedBulkCards}
            className="text-xs font-normal text-amber-800 dark:text-amber-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
            aria-label="Dismiss excluded cards notice"
          >
            Dismiss
          </button>
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc ml-5 mt-1 space-y-0.5 text-sm">
            {state.excludedBulkCards.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <span className="font-semibold">{c.quantity}x {titleCase(c.name)}</span>
                {' — '}
                {c.reason === 'banned'
                  ? <>banned in <span className="font-medium">{state.deck?.format ?? 'this format'}</span></>
                  : c.reason === 'format'
                    ? <>not legal in <span className="font-medium">{state.deck?.format ?? 'this format'}</span></>
                    : <>no matching card found</>}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
      );
    })()}

    {state.bulkResults.length > 0 && !state.loading && (
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => handlers.stageAll()}
          className="text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          Stage All
        </button>
        <button
          onClick={() => { handlers.clearBulkResults(); setSearchFormOpen(true); }}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Clear Results
        </button>
      </div>
    )}

    <BulkResultsGrid
      cards={state.bulkResults}
      loading={state.loading}
      hideStaged={false}
      onUpdatePrinting={handlers.updateCardPrinting}
      onQuantityChange={handlers.updateCardQuantity}
      onToggleTrade={() => {}}
      onDuplicate={handlers.duplicateCard}
      onRemove={handlers.removeCard}
      onToggleStaged={handlers.toggleStagedStatus}
      onPrintingView={id => onPrintingView(id)}
    />
    </>
  );
}

// components/binder/BinderEmptyState.tsx
"use client";

import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BinderEmptyStateProps {
  /** The current binder-filter search text. */
  searchQuery: string;
  /** Whether the viewer owns this binder (can add cards). */
  editable: boolean;
  /** Clear all active filters + search. */
  onClearFilters: () => void;
  /** Open the add-card flow, prefilled with the given query. */
  onAddCard: (query: string) => void;
}

/**
 * Empty state for the binder cards grid.
 *
 * Beyond the standard "adjust your filters" message, when an owner's search
 * returns nothing we offer a shortcut to add the card they were looking for —
 * opening the card-search dialog prefilled with the query they already typed.
 */
export function BinderEmptyState({
  searchQuery,
  editable,
  onClearFilters,
  onAddCard,
}: BinderEmptyStateProps) {
  const trimmedQuery = searchQuery.trim();
  const showAddWithQuery = editable && trimmedQuery.length > 0;

  return (
    <div className="text-center py-12 bg-card rounded-lg border">
      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium">No Cards Found</h3>
      <p className="text-muted-foreground mb-4">
        {showAddWithQuery
          ? `No cards in this binder match "${trimmedQuery}".`
          : "Try adjusting your search or filters."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onClearFilters} variant="outline">
          Clear Filters
        </Button>
        {showAddWithQuery && (
          <Button
            onClick={() => onAddCard(trimmedQuery)}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add "{trimmedQuery}" to binder
          </Button>
        )}
      </div>
    </div>
  );
}

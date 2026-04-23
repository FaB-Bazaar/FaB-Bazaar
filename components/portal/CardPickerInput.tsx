"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X, Check } from "lucide-react";

export function CardPickerInput({
  value,
  valueDisplayName,
  onChange,
  label = "Represents which FaB card?",
  description = "Search and pick the FaB card this token represents. Optional.",
}: {
  value: string | null;
  valueDisplayName?: string | null;
  onChange: (cardUniqueId: string | null, displayName: string | null) => void;
  label?: string;
  description?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ cardUniqueId: string; displayName: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "20" });
        const response = await fetch(`/api/printings/search?${params.toString()}`);
        const json = await response.json().catch(() => null);
        const printings: Array<{ card_unique_id: string; name: string }> =
          json?.data?.printings ?? [];

        // Dedupe by card_unique_id — many printings share one logical card
        const seen = new Set<string>();
        const unique: Array<{ cardUniqueId: string; displayName: string }> = [];
        for (const p of printings) {
          if (!p.card_unique_id || seen.has(p.card_unique_id)) continue;
          seen.add(p.card_unique_id);
          unique.push({ cardUniqueId: p.card_unique_id, displayName: p.name });
          if (unique.length >= 8) break;
        }
        setResults(unique);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const clearSelection = () => {
    onChange(null, null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={rootRef}>
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
              {valueDisplayName || value}
            </span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Never let Enter inside the card picker submit the parent form.
                e.preventDefault();
                // If there's a top result, pick it.
                const top = results[0];
                if (top) {
                  onChange(top.cardUniqueId, top.displayName);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type a card name, e.g. Ponder"
            className="pl-10"
          />

          {open && (
            <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
              {searching ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matches</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.cardUniqueId}
                    type="button"
                    onClick={() => {
                      onChange(r.cardUniqueId, r.displayName);
                      setQuery("");
                      setResults([]);
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {r.displayName}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}

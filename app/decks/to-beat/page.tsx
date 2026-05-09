"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, ChevronDown, Trophy, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { decksClient } from "@/lib/client";
import CommunityDeckCard from "@/components/deck/CommunityDeckCard";
import type { PublicDeckSummaryDTO, DeckFormat } from "@/lib/services/contracts/IDeckService";
import { HERO_INFO, YOUNG_HERO_INFO } from "@/lib/fab-constants";
import { useExcludedHeroIds } from "@/hooks/banned-cards/useExcludedHeroIds";

// ── Format helpers ────────────────────────────────────────────────────────────

const FORMAT_MAP: Record<string, string> = {
  cc: "Classic Constructed",
  classic: "Classic Constructed",
  "classic-constructed": "Classic Constructed",
  sa: "Silver Age",
  sage: "Silver Age",
  "silver-age": "Silver Age",
  blitz: "Blitz",
  commoner: "Commoner",
  ll: "Living Legend",
  "living-legend": "Living Legend",
  limited: "Limited",
  upf: "Ultimate Pit Fight",
  casual: "Casual",
};

const FORMAT_ABBREV: Record<string, string> = {
  "Classic Constructed": "cc",
  "Silver Age": "sa",
  Blitz: "blitz",
  Commoner: "commoner",
  "Living Legend": "ll",
};

const SECONDARY_FORMATS: DeckFormat[] = ["Blitz", "Commoner", "Living Legend", "Limited", "Casual"];

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDateParam(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  // "march2026" or "mar2026"
  const nameMatch = raw.match(/^([a-z]+)(\d{4})$/i);
  if (nameMatch) {
    const m = MONTH_NAMES[nameMatch[1].toLowerCase()];
    if (m) return { year: parseInt(nameMatch[2]), month: m };
  }
  // "2026-03"
  const isoMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) return { year: parseInt(isoMatch[1]), month: parseInt(isoMatch[2]) };
  return null;
}

function toDateParam(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1].toLowerCase()}${year}`;
}

// input[type=month] needs "2026-03"
function toMonthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Hero options ──────────────────────────────────────────────────────────────

function toDisplayName(name: string) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getHeroOptionsForFormat(format: string, excludedHeroIds: Set<string>) {
  const isExcluded = (cardUniqueId?: string) =>
    !!cardUniqueId && excludedHeroIds.has(cardUniqueId);
  const source = format === "Silver Age" || format === "Blitz" ? YOUNG_HERO_INFO : HERO_INFO;
  return Object.entries(source)
    .filter(([_, info]) => !isExcluded(info.cardUniqueId))
    .map(([key]) => ({ value: key, label: toDisplayName(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EventSummary {
  eventName: string;
  eventDate: string;
  format: string;
  count: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function DecksToBeatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Parse initial state from URL
  const initDate = parseDateParam(searchParams.get("date") ?? "");
  const [year, setYear] = useState(initDate?.year ?? currentYear);
  const [month, setMonth] = useState(initDate?.month ?? currentMonth);
  const [format, setFormat] = useState<string>(
    FORMAT_MAP[searchParams.get("format")?.toLowerCase() ?? ""] ??
    searchParams.get("format") ??
    "Classic Constructed"
  );
  const [heroName, setHeroName] = useState(searchParams.get("hero") ?? "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [usernameInput, setUsernameInput] = useState(searchParams.get("username") ?? "");
  const [username, setUsername] = useState(searchParams.get("username") ?? "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));
  const [selectedEvent, setSelectedEvent] = useState(searchParams.get("event") ?? "");

  const [decks, setDecks] = useState<PublicDeckSummaryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // Event catalog state
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch event summaries when month/year changes
  useEffect(() => {
    fetch(`/api/decks/events?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEvents(data.data);
          // Auto-expand formats that have events
          const formats = new Set(data.data.map((e: EventSummary) => e.format));
          setExpandedFormats(formats);
        }
      })
      .catch(() => {});
  }, [year, month]);

  // Group events by format
  const eventsByFormat = useMemo(() => {
    const grouped: Record<string, EventSummary[]> = {};
    for (const event of events) {
      if (!grouped[event.format]) grouped[event.format] = [];
      grouped[event.format].push(event);
    }
    return grouped;
  }, [events]);

  // Keep URL in sync with filter state
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("date", toDateParam(year, month));
    if (format && format !== "Classic Constructed") {
      params.set("format", FORMAT_ABBREV[format] ?? format.toLowerCase());
    }
    if (heroName) params.set("hero", heroName);
    if (search) params.set("search", search);
    if (username) params.set("username", username);
    if (selectedEvent) params.set("event", selectedEvent);
    if (page > 1) params.set("page", String(page));
    router.replace(`/decks/to-beat?${params.toString()}`, { scroll: false });
  }, [year, month, format, heroName, search, username, selectedEvent, page]);

  // Fetch data
  const fetchDecks = useCallback(async () => {
    setLoading(true);
    const result = await decksClient.getCommunityDecks(
      {
        featured: true,
        year,
        month,
        ...(format && { format: format as DeckFormat }),
        ...(heroName && { heroName }),
        ...(search && { search }),
        ...(username && { username }),
        ...(selectedEvent && { eventName: selectedEvent }),
      },
      { page, limit: PAGE_SIZE }
    );
    if (result.success) {
      setDecks(result.data.decks);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [year, month, format, heroName, search, username, selectedEvent, page]);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Debounce username
  useEffect(() => {
    const t = setTimeout(() => { setUsername(usernameInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [usernameInput]);

  const excludedHeroIds = useExcludedHeroIds(format);
  const heroOptions = useMemo(
    () => (format ? getHeroOptionsForFormat(format, excludedHeroIds) : []),
    [format, excludedHeroIds],
  );

  const handleFormatSelect = (f: string) => {
    setFormat(format === f ? "Classic Constructed" : f);
    setHeroName("");
    setSelectedEvent("");
    setPage(1);
  };

  const handleMonthChange = (value: string) => {
    const parsed = parseDateParam(value);
    if (parsed) { setYear(parsed.year); setMonth(parsed.month); setSelectedEvent(""); setPage(1); }
  };

  const handleEventSelect = (eventName: string, eventFormat: string) => {
    if (selectedEvent === eventName && format === eventFormat) {
      // Deselect
      setSelectedEvent("");
    } else {
      setSelectedEvent(eventName);
      setFormat(eventFormat);
      setPage(1);
    }
    setSidebarOpen(false);
  };

  const toggleFormat = (f: string) => {
    setExpandedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const handleCopy = async (deck: PublicDeckSummaryDTO) => {
    if (!user) {
      router.push("/auth/signin?callbackUrl=/decks/to-beat");
      return;
    }
    setCopyingId(deck.publicId);
    try {
      const result = await decksClient.copyDeck(deck.publicId, `Copy of ${deck.name}`);
      if (result.success) {
        toast({ title: "Deck copied", description: `"${deck.name}" has been copied to your decks.` });
      } else {
        toast({ title: "Error", description: result.error ?? "Failed to copy deck.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to copy deck.", variant: "destructive" });
    }
    setCopyingId(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;

  // ── Sidebar content ─────────────────────────────────────────────────────────

  const sidebarContent = (
    <div className="space-y-1">
      {/* All Events option */}
      <button
        onClick={() => { setSelectedEvent(""); setPage(1); setSidebarOpen(false); }}
        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          !selectedEvent
            ? "bg-blue-600/20 text-blue-400 font-medium border-l-2 border-blue-400"
            : "text-gray-300 hover:bg-gray-800 hover:text-gray-100 border-l-2 border-transparent"
        }`}
      >
        All Events
      </button>

      {Object.keys(eventsByFormat).length === 0 && (
        <p className="px-3 py-4 text-sm text-gray-400">No events for {monthLabel}</p>
      )}

      {Object.entries(eventsByFormat).map(([fmt, fmtEvents]) => (
        <div key={fmt}>
          <button
            onClick={() => toggleFormat(fmt)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-md"
          >
            <span>{fmt}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedFormats.has(fmt) ? "rotate-180" : ""}`} />
          </button>
          {expandedFormats.has(fmt) && (
            <div className="ml-2 space-y-0.5">
              {fmtEvents.map((event) => {
                const isActive = selectedEvent === event.eventName && format === fmt;
                return (
                  <button
                    key={`${fmt}-${event.eventName}`}
                    onClick={() => handleEventSelect(event.eventName, fmt)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isActive
                        ? "bg-blue-600/20 text-blue-400 font-medium border-l-2 border-blue-400"
                        : "text-gray-300 hover:bg-gray-800 hover:text-gray-100 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{event.eventName}</span>
                      <span className={`text-sm shrink-0 ml-2 ${isActive ? "text-blue-400" : "text-gray-400"}`}>
                        {event.count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-400">{formatEventDate(event.eventDate)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Decks to Beat</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Top competitive decks curated each month.{" "}
          <Link href="/decks/community" className="text-blue-500 hover:underline text-sm">
            Browse all community decks
          </Link>
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="month"
          value={toMonthInputValue(year, month)}
          max={toMonthInputValue(currentYear, currentMonth)}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        />
        {(["Classic Constructed", "Silver Age"] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFormatSelect(f)}
            className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              format === f
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400"
            }`}
          >
            {f === "Classic Constructed" ? "Classic" : f}
          </button>
        ))}
        <select
          value={SECONDARY_FORMATS.includes(format as DeckFormat) ? format : ""}
          onChange={(e) => { setFormat(e.target.value || "Classic Constructed"); setHeroName(""); setSelectedEvent(""); setPage(1); }}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <option value="">More formats...</option>
          {SECONDARY_FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Search / hero / username row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search decks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={heroName}
          onChange={(e) => { setHeroName(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300 sm:w-56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          disabled={!format}
        >
          <option value="">All Heroes</option>
          {heroOptions.map((h) => (
            <option key={h.value} value={h.value}>{h.label}</option>
          ))}
        </select>
        <Input
          placeholder="Username..."
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          className="sm:w-40"
        />
      </div>

      {/* Mobile event selector */}
      {events.length > 0 && (
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Trophy className="h-4 w-4" />
              {selectedEvent || "All Events"}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
          {sidebarOpen && (
            <div className="mt-2 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {sidebarContent}
            </div>
          )}
        </div>
      )}

      {/* Main layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        {events.length > 0 && (
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <h3 className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Trophy className="h-4 w-4" />
                Events
              </h3>
              {sidebarContent}
            </div>
          </aside>
        )}

        {/* Deck grid */}
        <div className="flex-1 min-w-0">
          {/* Active event badge */}
          {selectedEvent && (
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 text-sm font-medium">
                <Trophy className="h-3.5 w-3.5" />
                {selectedEvent}
                <button
                  onClick={() => { setSelectedEvent(""); setPage(1); }}
                  className="ml-1 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  aria-label="Clear event filter"
                >
                  &times;
                </button>
              </span>
            </div>
          )}

          {/* Results count */}
          {!loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {total} {total === 1 ? "deck" : "decks"} for {monthLabel}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-64 animate-pulse" />
              ))}
            </div>
          ) : decks.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <p className="text-lg">No featured decks for {monthLabel}</p>
              <p className="text-sm mt-1">Try a different month or format.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {decks.map((deck) => (
                <CommunityDeckCard
                  key={deck.publicId}
                  deck={deck}
                  onCopy={handleCopy}
                  copying={copyingId === deck.publicId}
                  showUsername={false}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 mr-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

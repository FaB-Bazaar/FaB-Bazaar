"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { decksClient } from "@/lib/client";
import CommunityDeckCard from "@/components/deck/CommunityDeckCard";
import type { PublicDeckSummaryDTO, DeckFormat } from "@/lib/services/contracts/IDeckService";
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants';
import { getBannedCardIds, getLivingLegendHeroIds } from '@/lib/fab-banned-cards';

const FORMATS: DeckFormat[] = [
  'Classic Constructed',
  'Blitz',
  'Silver Age',
  'Commoner',
  'Living Legend',
  'Limited',
  'Casual',
];

function toDisplayName(name: string) {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function getHeroOptionsForFormat(format: string) {
  const bannedIds = getBannedCardIds(format);
  const livingLegendIds = getLivingLegendHeroIds(format);
  const isExcluded = (cardUniqueId?: string) =>
    cardUniqueId && (bannedIds.has(cardUniqueId) || livingLegendIds.has(cardUniqueId));

  const source = (format === 'Silver Age' || format === 'Blitz') ? YOUNG_HERO_INFO : HERO_INFO;

  return Object.entries(source)
    .filter(([_, info]) => !isExcluded(info.cardUniqueId))
    .map(([key]) => ({ value: key, label: toDisplayName(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const PAGE_SIZE = 20;

export default function CommunityDecksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  // Tab state
  const [tab, setTab] = useState<'all' | 'featured'>(
    searchParams.get('tab') === 'featured' ? 'featured' : 'all'
  );

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [format, setFormat] = useState<string>(searchParams.get('format') || (searchParams.get('tab') === 'featured' ? 'Classic Constructed' : ''));
  const [heroName, setHeroName] = useState(searchParams.get('hero') || '');
  const [username, setUsername] = useState(searchParams.get('username') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Featured month filter
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [featuredMonth, setFeaturedMonth] = useState<string>(currentMonth);

  // Hero options based on selected format
  const heroOptions = useMemo(() => {
    if (!format) return [];
    return getHeroOptionsForFormat(format);
  }, [format]);

  // Data
  const [decks, setDecks] = useState<PublicDeckSummaryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    const filters: Record<string, any> = {
      ...(search && { search }),
      ...(format && { format: format as DeckFormat }),
      ...(heroName && { heroName }),
      ...(username && { username }),
      ...(tab === 'featured' && { featured: true }),
    };
    if (tab === 'featured' && featuredMonth) {
      const [y, m] = featuredMonth.split('-');
      filters.year = parseInt(y, 10);
      filters.month = parseInt(m, 10);
    }

    const result = await decksClient.getCommunityDecks(filters, { page, limit: PAGE_SIZE });
    if (result.success) {
      setDecks(result.data.decks);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [search, format, heroName, username, page, tab, featuredMonth]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounced username
  const [usernameInput, setUsernameInput] = useState(username);
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsername(usernameInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [usernameInput]);

  const handleCopy = async (deck: PublicDeckSummaryDTO) => {
    if (!user) {
      router.push('/auth/signin?callbackUrl=/decks/community');
      return;
    }

    setCopyingId(deck.publicId);
    try {
      const result = await decksClient.copyDeck(deck.publicId, `Copy of ${deck.name}`);
      if (result.success) {
        toast({
          title: "Deck copied",
          description: `"${deck.name}" has been copied to your decks.`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to copy deck.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy deck.",
        variant: "destructive",
      });
    }
    setCopyingId(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Community Decks
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse public decks shared by the community. Copy any deck to start building from it.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => { setTab('all'); setPage(1); setFeaturedMonth(currentMonth); setFormat(''); setHeroName(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'all'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          All Decks
        </button>
        <button
          onClick={() => { setTab('featured'); setPage(1); setFormat('Classic Constructed'); setHeroName(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'featured'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Decks to Beat
        </button>
      </div>

      {/* Featured tab controls: month + format */}
      {tab === 'featured' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            type="month"
            value={featuredMonth}
            max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => { setFeaturedMonth(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300"
          />
          {(['Classic Constructed', 'Silver Age'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFormat(format === f ? '' : f); setHeroName(''); setPage(1); }}
              className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
                format === f
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              {f === 'Classic Constructed' ? 'Classic' : f}
            </button>
          ))}
          <select
            value={['Classic Constructed', 'Silver Age'].includes(format) ? '' : format}
            onChange={(e) => { setFormat(e.target.value); setHeroName(''); setPage(1); }}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300"
          >
            <option value="">More formats...</option>
            {FORMATS.filter((f) => !['Classic Constructed', 'Silver Age'].includes(f)).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
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
        {tab === 'all' && (
          <select
            value={format}
            onChange={(e) => { setFormat(e.target.value); setHeroName(''); setPage(1); }}
            className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300"
          >
            <option value="">All Formats</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        <select
          value={heroName}
          onChange={(e) => { setHeroName(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 text-gray-700 dark:text-gray-300 sm:w-56"
          disabled={!format}
        >
          <option value="">{format ? 'All Heroes' : 'Select format first'}</option>
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

      {/* Results count */}
      {!loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {total} {total === 1 ? 'deck' : 'decks'} found
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-64 animate-pulse" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg">No public decks found</p>
          <p className="text-sm mt-1">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {decks.map((deck) => (
            <CommunityDeckCard
              key={deck.publicId}
              deck={deck}
              onCopy={handleCopy}
              copying={copyingId === deck.publicId}
              showUsername={tab !== 'featured'}
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
            onClick={() => setPage(p => Math.max(1, p - 1))}
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
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

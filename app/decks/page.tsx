// app/decks/page.tsx - Main decks management page
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { decksClient } from "@/lib/client";
import { HERO_INFO, YOUNG_HERO_INFO, sortPrintings } from "@/lib/fab-constants";

// Import deck-specific components
import DeckCard from "@/components/deck/DeckCard";
import CreateDeckDialog from "@/components/deck/CreateDeckDialog";
import DeckStats from "@/components/deck/DeckStats";
import DeckSettings from "@/components/deck/DeckSettings";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  printingDetails?: any;
}

interface Deck {
  _id: string;
  publicId: string;  // Globally unique identifier for URLs
  userId: string;
  name: string;
  description?: string;
  format: string;
  visibility?: 'private' | 'unlisted' | 'public';
  isPublic: boolean;
  availableOnTalishar?: boolean;
  featured?: boolean;
  metafyGuideId?: string | null;
  // New structure - arrays by category
  hero: DeckPrinting[];
  equipment: DeckPrinting[];
  maindeck: DeckPrinting[];
  inventory: DeckPrinting[];
  maybeboard?: DeckPrinting[];
  tokens?: DeckPrinting[];
  // Computed stats
  totalCards: number;
  heroCount: number;
  equipmentCount: number;
  maindeckCount: number;
  inventoryCount: number;
  maybeboardCount?: number;
  tokensCount?: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
  // Computed fields for backwards compatibility
  uniqueCards?: number;
  fabraryUrl?: string;
}

export default function DecksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Core state
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMetafyAccount, setHasMetafyAccount] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFormat, setFilterFormat] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all"); // all, public, private
  const [sortBy, setSortBy] = useState("updated"); // updated, created, name, value
  const [activeTab, setActiveTab] = useState("decks");
  const [createDeckOpen, setCreateDeckOpen] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const [settingsDeck, setSettingsDeck] = useState<Deck | null>(null);

  // Fetch user's decks and Metafy status
  useEffect(() => {
    if (user) {
      fetchDecks();
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(data => { if (data.success) setHasMetafyAccount(!!data.user?.metafyLinked); })
        .catch(() => {});
    }
  }, [user]);

  // Auto-open create dialog from URL param
  useEffect(() => {
    if (searchParams.get('create') === 'true' && user) {
      setCreateDeckOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('create');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, user]);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await decksClient.getUserDecks();

      if (result.success) {
        setDecks(result.data.decks || []);
      } else {
        throw new Error(result.error || 'Failed to load decks');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load decks');
      console.error('Error fetching decks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle deck creation
  const handleCreateDeck = async (deckData: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    heroPrintingId?: string;
    isPublic: boolean;
  }) => {
    try {
      if (!deckData.hero) {
        throw new Error('A hero is required to create a deck');
      }

      console.log('[Decks] Creating new deck:', deckData.name);

      // Resolve hero printing before creating the deck so it's added atomically
      let heroPrintingId = deckData.heroPrintingId;
      if (!heroPrintingId) {
        const heroKey = deckData.hero.toLowerCase();
        const heroInfo = HERO_INFO[heroKey as keyof typeof HERO_INFO]
          ?? YOUNG_HERO_INFO[heroKey as keyof typeof YOUNG_HERO_INFO];
        if (heroInfo?.cardUniqueId) {
          const params = new URLSearchParams({ cardUniqueId: heroInfo.cardUniqueId, limit: '50', show: 'browse_bulk' });
          const printingsRes = await fetch(`/api/printings/search?${params}`);
          const printingsData = await printingsRes.json();
          const printings: any[] = printingsData.data?.printings ?? [];
          const firstPrinting = sortPrintings(printings)[0];
          heroPrintingId = firstPrinting?.printing_id;
        }
        if (!heroPrintingId) {
          throw new Error('Could not resolve a printing for the selected hero');
        }
      }

      const result = await decksClient.createDeck({ ...deckData, heroPrintingId });

      if (result.success) {
        console.log('[Decks] Deck created successfully:', result.data);

        setDecks(prev => [result.data, ...prev]);
        setCreateDeckOpen(false);

        // Dispatch event to update navbar
        console.log('[Decks] Dispatching deckCreated event');
        window.dispatchEvent(new CustomEvent('deckCreated'));
        console.log('[Decks] Event dispatched successfully');

        toast({
          title: "Deck created",
          description: `${deckData.name} has been created successfully.`,
        });

        // Navigate to the new deck builder using publicId
        router.push(`/decks/${result.data.publicId}`);
      } else {
        throw new Error(result.error || 'Failed to create deck');
      }
    } catch (err: any) {
      console.error('Failed to create deck:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to create deck.",
        variant: "destructive"
      });
    }
  };

  // Handle deck deletion
  const handleDeleteDeck = (deckId: string) => {
    setDeletingDeckId(deckId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDeckId) return;
    const deckId = deletingDeckId;
    setDeletingDeckId(null);

    try {
      console.log('[Decks] Deleting deck:', deckId);

      const result = await decksClient.deleteDeck(deckId);

      if (result.success) {
        console.log('[Decks] Deck deleted successfully');

        // Filter by publicId (the deckId we pass is now publicId)
        setDecks(prev => prev.filter(deck => deck.publicId !== deckId));

        // Dispatch event to update navbar
        console.log('[Decks] Dispatching deckDeleted event');
        window.dispatchEvent(new CustomEvent('deckDeleted'));
        console.log('[Decks] Event dispatched successfully');

        toast({
          title: "Deck deleted",
          description: "Deck has been removed successfully.",
        });
      } else {
        throw new Error(result.error || 'Failed to delete deck');
      }
    } catch (err: any) {
      console.error('Failed to delete deck:', err);
      toast({
        title: "Error",
        description: "Failed to delete deck.",
        variant: "destructive"
      });
    }
  };

  // Handle deck duplication
  const handleDuplicateDeck = async (deck: Deck) => {
    try {
      console.log('[Decks] Duplicating deck:', deck.name);

      const result = await decksClient.duplicateDeck(deck.publicId);

      if (result.success) {
        console.log('[Decks] Deck duplicated successfully:', result.data);

        setDecks(prev => [result.data, ...prev]);

        // Dispatch event to update navbar (duplication creates a new deck)
        console.log('[Decks] Dispatching deckCreated event for duplication');
        window.dispatchEvent(new CustomEvent('deckCreated'));
        console.log('[Decks] Event dispatched successfully');

        toast({
          title: "Deck duplicated",
          description: `Copy of ${deck.name} has been created.`,
        });
      } else {
        throw new Error(result.error || 'Failed to duplicate deck');
      }
    } catch (err: any) {
      console.error('Failed to duplicate deck:', err);
      toast({
        title: "Error",
        description: "Failed to duplicate deck.",
        variant: "destructive"
      });
    }
  };

  // Handle visibility change
  const handleChangeVisibility = async (deckId: string, value: 'private' | 'unlisted' | 'public') => {
    const prevDeck = decks.find(d => d.publicId === deckId);
    setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, visibility: value, isPublic: value !== 'private' } : d));
    const result = await decksClient.updateDeck(deckId, { visibility: value });
    if (!result.success) {
      if (prevDeck) {
        setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, visibility: prevDeck.visibility, isPublic: prevDeck.isPublic } : d));
      }
      toast({ title: "Error", description: "Failed to update visibility.", variant: "destructive" });
    }
  };

  // Handle Talishar toggle
  const handleToggleTalishar = async (deckId: string, value: boolean) => {
    setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, availableOnTalishar: value } : d));
    const result = await decksClient.updateDeck(deckId, { availableOnTalishar: value });
    if (!result.success) {
      setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, availableOnTalishar: !value } : d));
      toast({ title: "Error", description: "Failed to update Talishar setting.", variant: "destructive" });
    }
  };

  // Handle Featured toggle (Decks to Beat)
  const handleToggleFeatured = async (deckId: string, value: boolean) => {
    setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, featured: value } : d));
    const result = await decksClient.toggleFeatured(deckId, value);
    if (!result.success) {
      setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, featured: !value } : d));
      toast({ title: "Error", description: "Failed to update featured status.", variant: "destructive" });
    }
  };

  // Handle Metafy Guide ID update
  const handleUpdateMetafyGuideId = async (deckId: string, value: string | null) => {
    setDecks(prev => prev.map(d => d.publicId === deckId ? { ...d, metafyGuideId: value } : d));
    const result = await decksClient.updateDeck(deckId, { metafyGuideId: value });
    if (!result.success) {
      toast({ title: "Error", description: "Failed to update Metafy Guide ID.", variant: "destructive" });
    }
  };

  const handleSaveSettings = async (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    visibility: 'private' | 'unlisted' | 'public';
    isPublic: boolean;
    availableOnTalishar: boolean;
    metafyGuideId: string | null;
  }) => {
    if (!settingsDeck) return;
    const result = await decksClient.updateDeck(settingsDeck.publicId, {
      name: settings.name,
      description: settings.description,
      format: settings.format,
      heroName: settings.hero,
      visibility: settings.visibility,
      availableOnTalishar: settings.availableOnTalishar,
      metafyGuideId: settings.metafyGuideId,
    } as any);
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      throw new Error(result.error);
    }
    setDecks(prev => prev.map(d =>
      d.publicId === settingsDeck.publicId
        ? { ...d, ...settings, heroName: settings.hero, isPublic: settings.visibility === 'public' }
        : d
    ));
    setSettingsDeck(prev => prev ? { ...prev, ...settings, heroName: settings.hero } : prev);
    toast({ title: "Settings saved" });
  };

  // Calculate unique cards for a deck (for backwards compatibility)
  const calculateUniqueCards = (deck: Deck): number => {
    const uniqueCardIds = new Set();
    
    // Combine all category arrays and count unique cards
    const allPrintings = [
      ...(deck.hero || []),
      ...(deck.equipment || []),
      ...(deck.maindeck || []),
      ...(deck.inventory || []),
      ...(deck.maybeboard || []),
      ...(deck.tokens || [])
    ];
    
    allPrintings.forEach(printing => {
      const cardId = printing.printingDetails?.card_unique_id || printing.printingId;
      uniqueCardIds.add(cardId);
    });
    
    return uniqueCardIds.size;
  };

  // Filter and sort decks
  const filteredAndSortedDecks = decks
    .filter(deck => {
      const matchesSearch = !searchQuery || 
        deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFormat = filterFormat === "all" || deck.format === filterFormat;
      
      const matchesVisibility = filterVisibility === "all" ||
        (deck.visibility || 'unlisted') === filterVisibility;

      return matchesSearch && matchesFormat && matchesVisibility;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "value":
          return (b.estimatedValue || 0) - (a.estimatedValue || 0);
        case "updated":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  // Get available formats
  const availableFormats = Array.from(new Set(decks.map(deck => deck.format)));

  // Calculate stats using new structure
  const stats = {
    totalDecks: decks.length,
    publicDecks: decks.filter(deck => deck.isPublic).length,
    totalCards: decks.reduce((total, deck) => total + (deck.totalCards || 0), 0),
    totalUniqueCards: decks.reduce((total, deck) => total + calculateUniqueCards(deck), 0),
    totalEstimatedValue: decks.reduce((total, deck) => total + (deck.estimatedValue || 0), 0),
    formatBreakdown: availableFormats.map(format => ({
      format,
      count: decks.filter(deck => deck.format === format).length,
      totalValue: decks
        .filter(deck => deck.format === format)
        .reduce((total, deck) => total + (deck.estimatedValue || 0), 0),
      totalCards: decks
        .filter(deck => deck.format === format)
        .reduce((total, deck) => total + (deck.totalCards || 0), 0)
    })),
    categoryBreakdown: {
      heroes: decks.reduce((total, deck) => total + (deck.heroCount || 0), 0),
      equipment: decks.reduce((total, deck) => total + (deck.equipmentCount || 0), 0),
      maindeck: decks.reduce((total, deck) => total + (deck.maindeckCount || 0), 0),
      inventory: decks.reduce((total, deck) => total + (deck.inventoryCount || 0), 0),
      maybeboard: decks.reduce((total, deck) => total + (deck.maybeboardCount || 0), 0),
      tokens: decks.reduce((total, deck) => total + (deck.tokensCount || 0), 0)
    },
    recentActivity: decks
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign In Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Please sign in to manage your decks.</p>
          <Button onClick={() => router.push('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading decks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Decks</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <Button onClick={fetchDecks} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Create Deck Dialog */}
      <CreateDeckDialog
        open={createDeckOpen}
        onOpenChange={setCreateDeckOpen}
        onCreateDeck={handleCreateDeck}
      />

      {/* Delete Confirmation Dialog */}
      {settingsDeck && (
        <DeckSettings
          deck={{ ...settingsDeck, _id: settingsDeck.publicId, hero: settingsDeck.heroName }}
          open={!!settingsDeck}
          onOpenChange={(open) => { if (!open) setSettingsDeck(null); }}
          onSave={handleSaveSettings}
          isMetafyPartner={hasMetafyAccount}
          deckId={settingsDeck.publicId}
          fullDeck={settingsDeck}
        />
      )}

      <AlertDialog open={!!deletingDeckId} onOpenChange={open => !open && setDeletingDeckId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deck?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the deck and all its cards. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            My Decks
          </h1>
          
          <div className="flex items-center gap-2 sm:gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{decks.length} decks</span>
              <span>{stats.publicDecks} public</span>
              <span>{stats.totalCards} total cards</span>
            </div>

            {stats.totalEstimatedValue > 0 && (
              <Badge variant="secondary" className="text-green-600 dark:text-green-400 font-semibold">
                ~${stats.totalEstimatedValue.toFixed(2)} collection value
              </Badge>
            )}
          </div>

          <Button
            onClick={() => setCreateDeckOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Deck
          </Button>
        </div>

        {/* Talishar / Metafy info strip */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 mb-6 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="https://talishar.net/assets/CoinLogo-CXy1VyVE.png"
              alt="Talishar"
              className="h-5 w-5 object-contain flex-shrink-0"
            />
            <span className="text-gray-600 dark:text-gray-400 truncate">
              Toggle <span className="font-medium text-gray-800 dark:text-gray-200">Available on Talishar</span> on any deck to include it when Talishar imports your decks via Metafy.
            </span>
          </div>
          <div className="flex-shrink-0">
            {hasMetafyAccount ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Metafy connected
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3"
                onClick={() => { window.location.href = "/api/auth/metafy/authorize"; }}
              >
                Connect Metafy
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search decks by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterFormat}
                onChange={(e) => setFilterFormat(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-0"
              >
                <option value="all">All Formats</option>
                {availableFormats.map(format => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>

              <select
                value={filterVisibility}
                onChange={(e) => setFilterVisibility(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-0"
              >
                <option value="all">All Visibility</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-0"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
                <option value="value">Estimated Value</option>
              </select>
            </div>
          </div>

          {/* Active filters indicator */}
          {(searchQuery || filterFormat !== "all" || filterVisibility !== "all") && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredAndSortedDecks.length} of {decks.length} decks
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterFormat("all");
                  setFilterVisibility("all");
                }}
                className="ml-auto text-xs"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="decks">
              Decks ({filteredAndSortedDecks.length})
            </TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="decks" className="space-y-6">
            {filteredAndSortedDecks.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {decks.length === 0 ? "No decks yet" : "No decks match your filters"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {decks.length === 0 ? 
                    "Create your first deck to start building your collection" : 
                    "Try adjusting your search criteria"
                  }
                </p>
                {decks.length === 0 && (
                  <Button onClick={() => setCreateDeckOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Deck
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedDecks.map((deck) => (
                  <DeckCard
                    key={deck.publicId}
                    deck={deck}
                    onEdit={() => router.push(`/decks/${deck.publicId}`)}
                    onDelete={() => handleDeleteDeck(deck.publicId)}
                    onDuplicate={() => handleDuplicateDeck(deck)}
                    onView={() => router.push(`/decks/${deck.publicId}/analyze`)}
                    onSettings={() => setSettingsDeck(deck)}
                    hasMetafyAccount={hasMetafyAccount}
                    onChangeVisibility={handleChangeVisibility}
                    onToggleTalishar={handleToggleTalishar}
                    onToggleFeatured={handleToggleFeatured}
                    isCurator={user?.isCurator || user?.isSuperAdmin}
                    onUpdateMetafyGuideId={handleUpdateMetafyGuideId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <DeckStats 
              stats={stats} 
              onViewFormat={(format) => {
                setFilterFormat(format);
                setActiveTab("decks");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
// // app/decks/page.tsx - Main decks management page
// "use client";

// import React, { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Input } from "@/components/ui/input";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { 
//   Plus, 
//   Search, 
//   BookOpen, 
//   Filter
// } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";
// import { useToast } from "@/hooks/use-toast";

// // Import deck-specific components
// import DeckCard from "@/components/deck/DeckCard";
// import CreateDeckDialog from "@/components/deck/CreateDeckDialog";
// import DeckStats from "@/components/deck/DeckStats";

// interface DeckCardEntry {
//   printingId: string;
//   category: 'hero' | 'equipment' | 'main' | 'sideboard';
//   condition?: string;
//   notes?: string;
//   // Hydrated from search API
//   printingDetails?: any;
// }

// interface Deck {
//   _id: string;
//   userId: string;
//   name: string;
//   description?: string;
//   format: string;
//   hero?: string;
//   isPublic: boolean;
//   cards: DeckCardEntry[];
//   createdAt: string;
//   updatedAt: string;
//   // Computed fields
//   totalCards: number;
//   uniqueCards: number;
//   estimatedValue: number;
//   fabraryUrl?: string;
// }

// export default function DecksPage() {
//   const router = useRouter();
//   const { user, loading: authLoading } = useAuth();
//   const { toast } = useToast();

//   // Core state
//   const [decks, setDecks] = useState<Deck[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   // UI state
//   const [searchQuery, setSearchQuery] = useState("");
//   const [filterFormat, setFilterFormat] = useState("all");
//   const [filterVisibility, setFilterVisibility] = useState("all"); // all, public, private
//   const [sortBy, setSortBy] = useState("updated"); // updated, created, name, value
//   const [activeTab, setActiveTab] = useState("decks");
//   const [createDeckOpen, setCreateDeckOpen] = useState(false);

//   // Fetch user's decks
//   useEffect(() => {
//     if (user) {
//       fetchDecks();
//     }
//   }, [user]);

//   const fetchDecks = async () => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       const response = await fetch('/api/decks');
      
//       if (!response.ok) {
//         throw new Error('Failed to fetch decks');
//       }
      
//       const data = await response.json();
      
//       if (data.success) {
//         setDecks(data.decks || []);
//       } else {
//         throw new Error(data.error || 'Failed to load decks');
//       }
//     } catch (err: any) {
//       setError(err.message || 'Failed to load decks');
//       console.error('Error fetching decks:', err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle deck creation
//   const handleCreateDeck = async (deckData: {
//     name: string;
//     description: string;
//     format: string;
//     hero?: string;
//     isPublic: boolean;
//   }) => {
//     try {
//       const response = await fetch('/api/decks', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(deckData),
//       });
      
//       const data = await response.json();
      
//       if (data.success) {
//         setDecks(prev => [data.deck, ...prev]);
//         setCreateDeckOpen(false);
//         toast({
//           title: "Deck created",
//           description: `${deckData.name} has been created successfully.`,
//         });
        
//         // Navigate to the new deck builder
//         router.push(`/decks/${data.deck._id}`);
//       } else {
//         throw new Error(data.error || 'Failed to create deck');
//       }
//     } catch (err: any) {
//       console.error('Failed to create deck:', err);
//       toast({
//         title: "Error",
//         description: "Failed to create deck.",
//         variant: "destructive"
//       });
//     }
//   };

//   // Handle deck deletion
//   const handleDeleteDeck = async (deckId: string) => {
//     if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) return;
    
//     try {
//       const response = await fetch(`/api/decks/${deckId}`, {
//         method: 'DELETE',
//       });
      
//       if (!response.ok) {
//         throw new Error('Failed to delete deck');
//       }
      
//       setDecks(prev => prev.filter(deck => deck._id !== deckId));
//       toast({
//         title: "Deck deleted",
//         description: "Deck has been removed successfully.",
//       });
//     } catch (err: any) {
//       console.error('Failed to delete deck:', err);
//       toast({
//         title: "Error",
//         description: "Failed to delete deck.",
//         variant: "destructive"
//       });
//     }
//   };

//   // Handle deck duplication
//   const handleDuplicateDeck = async (deck: Deck) => {
//     try {
//       const response = await fetch(`/api/decks/${deck._id}/duplicate`, {
//         method: 'POST',
//       });
      
//       const data = await response.json();
      
//       if (data.success) {
//         setDecks(prev => [data.deck, ...prev]);
//         toast({
//           title: "Deck duplicated",
//           description: `Copy of ${deck.name} has been created.`,
//         });
//       } else {
//         throw new Error(data.error || 'Failed to duplicate deck');
//       }
//     } catch (err: any) {
//       console.error('Failed to duplicate deck:', err);
//       toast({
//         title: "Error",
//         description: "Failed to duplicate deck.",
//         variant: "destructive"
//       });
//     }
//   };

//   // Filter and sort decks
//   const filteredAndSortedDecks = decks
//     .filter(deck => {
//       const matchesSearch = !searchQuery || 
//         deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         deck.hero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         deck.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
//       const matchesFormat = filterFormat === "all" || deck.format === filterFormat;
      
//       const matchesVisibility = filterVisibility === "all" ||
//         (filterVisibility === "public" && deck.isPublic) ||
//         (filterVisibility === "private" && !deck.isPublic);

//       return matchesSearch && matchesFormat && matchesVisibility;
//     })
//     .sort((a, b) => {
//       switch (sortBy) {
//         case "name":
//           return a.name.localeCompare(b.name);
//         case "created":
//           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
//         case "value":
//           return (b.estimatedValue || 0) - (a.estimatedValue || 0);
//         case "updated":
//         default:
//           return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
//       }
//     });

//   // Get available formats
//   const availableFormats = Array.from(new Set(decks.map(deck => deck.format)));

//   // Calculate stats
//   const stats = {
//     totalDecks: decks.length,
//     publicDecks: decks.filter(deck => deck.isPublic).length,
//     totalCards: decks.reduce((total, deck) => total + deck.totalCards, 0),
//     totalUniqueCards: decks.reduce((total, deck) => total + deck.uniqueCards, 0),
//     totalEstimatedValue: decks.reduce((total, deck) => total + (deck.estimatedValue || 0), 0),
//     formatBreakdown: availableFormats.map(format => ({
//       format,
//       count: decks.filter(deck => deck.format === format).length,
//       totalValue: decks
//         .filter(deck => deck.format === format)
//         .reduce((total, deck) => total + (deck.estimatedValue || 0), 0)
//     })),
//     recentActivity: decks
//       .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
//       .slice(0, 5)
//   };

//   if (authLoading) {
//     return (
//       <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
//           <p className="text-gray-600 dark:text-gray-300">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
//         <div className="text-center">
//           <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign In Required</h2>
//           <p className="text-gray-600 dark:text-gray-300 mb-4">Please sign in to manage your decks.</p>
//           <Button onClick={() => router.push('/auth')}>
//             Sign In
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
//           <p className="text-gray-600 dark:text-gray-300">Loading decks...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
//         <div className="text-center">
//           <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Decks</h2>
//           <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
//           <Button onClick={fetchDecks} variant="outline">
//             Try Again
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
//       {/* Create Deck Dialog */}
//       <CreateDeckDialog
//         open={createDeckOpen}
//         onOpenChange={setCreateDeckOpen}
//         onCreateDeck={handleCreateDeck}
//       />

//       <div className="container mx-auto px-4 py-6">
//         {/* Header */}
//         <div className="mb-6">
//           <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
//             My Decks
//           </h1>
          
//           <div className="flex items-center gap-6 mb-4">
//             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
//               <span>{decks.length} decks</span>
//               <span>{stats.publicDecks} public</span>
//               <span>{stats.totalCards} total cards</span>
//             </div>

//             {stats.totalEstimatedValue > 0 && (
//               <Badge variant="secondary" className="text-green-600 dark:text-green-400 font-semibold">
//                 ~${stats.totalEstimatedValue.toFixed(2)} collection value
//               </Badge>
//             )}
//           </div>

//           <Button 
//             onClick={() => setCreateDeckOpen(true)}
//             className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
//           >
//             <Plus className="h-4 w-4 mr-2" />
//             Create New Deck
//           </Button>
//         </div>

//         {/* Search and Filters */}
//         <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 mb-6">
//           <div className="flex flex-col sm:flex-row gap-4">
//             {/* Search */}
//             <div className="relative flex-1">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
//               <Input
//                 placeholder="Search decks by name, hero, or description..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="pl-10"
//               />
//             </div>
            
//             {/* Filters */}
//             <div className="flex gap-2">
//               <select
//                 value={filterFormat}
//                 onChange={(e) => setFilterFormat(e.target.value)}
//                 className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
//               >
//                 <option value="all">All Formats</option>
//                 {availableFormats.map(format => (
//                   <option key={format} value={format}>{format}</option>
//                 ))}
//               </select>

//               <select
//                 value={filterVisibility}
//                 onChange={(e) => setFilterVisibility(e.target.value)}
//                 className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
//               >
//                 <option value="all">All Decks</option>
//                 <option value="public">Public Only</option>
//                 <option value="private">Private Only</option>
//               </select>

//               <select
//                 value={sortBy}
//                 onChange={(e) => setSortBy(e.target.value)}
//                 className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
//               >
//                 <option value="updated">Last Updated</option>
//                 <option value="created">Date Created</option>
//                 <option value="name">Name</option>
//                 <option value="value">Estimated Value</option>
//               </select>
//             </div>
//           </div>

//           {/* Active filters indicator */}
//           {(searchQuery || filterFormat !== "all" || filterVisibility !== "all") && (
//             <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
//               <Filter className="h-4 w-4 text-gray-500" />
//               <span className="text-sm text-gray-600 dark:text-gray-400">
//                 Showing {filteredAndSortedDecks.length} of {decks.length} decks
//               </span>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={() => {
//                   setSearchQuery("");
//                   setFilterFormat("all");
//                   setFilterVisibility("all");
//                 }}
//                 className="ml-auto text-xs"
//               >
//                 Clear filters
//               </Button>
//             </div>
//           )}
//         </div>

//         {/* Tabs */}
//         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
//           <TabsList className="grid w-full grid-cols-2 mb-6">
//             <TabsTrigger value="decks">
//               Decks ({filteredAndSortedDecks.length})
//             </TabsTrigger>
//             <TabsTrigger value="stats">Statistics</TabsTrigger>
//           </TabsList>

//           <TabsContent value="decks" className="space-y-6">
//             {filteredAndSortedDecks.length === 0 ? (
//               <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
//                 <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
//                 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
//                   {decks.length === 0 ? "No decks yet" : "No decks match your filters"}
//                 </h3>
//                 <p className="text-gray-500 dark:text-gray-400 mb-4">
//                   {decks.length === 0 ? 
//                     "Create your first deck to start building your collection" : 
//                     "Try adjusting your search criteria"
//                   }
//                 </p>
//                 {decks.length === 0 && (
//                   <Button onClick={() => setCreateDeckOpen(true)}>
//                     <Plus className="h-4 w-4 mr-2" />
//                     Create Your First Deck
//                   </Button>
//                 )}
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//                 {filteredAndSortedDecks.map((deck) => (
//                   <DeckCard
//                     key={deck._id}
//                     deck={deck}
//                     onEdit={() => router.push(`/decks/${deck._id}`)}
//                     onDelete={() => handleDeleteDeck(deck._id)}
//                     onDuplicate={() => handleDuplicateDeck(deck)}
//                     onView={() => router.push(`/decks/${deck._id}`)}
//                   />
//                 ))}
//               </div>
//             )}
//           </TabsContent>

//           <TabsContent value="stats">
//             <DeckStats 
//               stats={stats} 
//               onViewFormat={(format) => {
//                 setFilterFormat(format);
//                 setActiveTab("decks");
//               }}
//             />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </div>
//   );
// }
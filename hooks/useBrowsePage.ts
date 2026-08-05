"use client"

import { useState, useEffect, useRef } from "react";
import { parseBulkInput } from '@/lib/browse/parsers/bulk-input-parser';
import { selectDefaultPrinting, getDefaultDeckName, calculateTotalQuantity } from '@/lib/browse/utils';
import { searchCards, fetchUserBinders, fetchUserDecks, fetchMetadata, addToWantsList, createBinder, createDeck, addCardsToBinder } from '@/lib/browse/api';
import { handleImportToDeck as handleDeckImport, handleImportToNewDeck as handleNewDeckImport } from '@/lib/deck-allocation';
import { formatWantsRemoved } from '@/lib/wants/format-wants-removed';

// Helper function to group a flat list of printings into cards, each with a `printings` array.
const groupPrintingsByCard = (printings: any[]) => {
  if (!printings || printings.length === 0) return [];

  const cardMap = new Map();

  for (const printing of printings) {
    const cardId = printing.card_unique_id;
    if (!cardMap.has(cardId)) {
      cardMap.set(cardId, {
        card_unique_id: cardId,
        name: printing.name,
        importQuantity: printing.importQuantity, 
        printings: [],
      });
    }
    cardMap.get(cardId).printings.push(printing);
  }

  return Array.from(cardMap.values());
};

interface UseBrowsePageProps {
  user: any;
  toast: (options: any) => void;
}

export function useBrowsePage({ user, toast }: UseBrowsePageProps) {
  // --- STATE MANAGEMENT ---
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterSet, setFilterSet] = useState("");
  const [filterRarity, setFilterRarity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const cardsPerPage = 12;

  const [importMode, setImportMode] = useState<'binder' | 'deck'>('binder');
  const [userDecks, setUserDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckPrompt, setShowNewDeckPrompt] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("Classic Constructed");
  const [createdDeckId, setCreatedDeckId] = useState<string | null>(null);

  const [sets, setSets] = useState<any[]>([]);
  const [rarities, setRarities] = useState<any[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkImportSource, setBulkImportSource] = useState<'fabrary' | 'cardlist' | 'fabtcg'>('fabrary');

  const [creatingBinder, setCreatingBinder] = useState(false);
  const [createdBinderId, setCreatedBinderId] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const [pendingImport, setPendingImport] = useState<any[]>([]);
  const [justAddedToWants, setJustAddedToWants] = useState<string | null>(null);
  const [userBinders, setUserBinders] = useState<any[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string>("");
  const [showNewBinderPrompt, setShowNewBinderPrompt] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [singleSelections, setSingleSelections] = useState<Record<string, any>>({});
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const initialRender = useRef(true);

  // --- DATA FETCHING & EFFECTS ---
  useEffect(() => {
    if (user) {
      fetchUserBinders().then(binders => { setUserBinders(binders); if (binders.length > 0) setSelectedBinderId(binders[0]._id); }).catch(() => setUserBinders([]));
      fetchUserDecks().then(decks => { setUserDecks(decks); if (decks.length > 0) setSelectedDeckId(decks[0]._id); }).catch(() => setUserDecks([]));
    }
  }, [user]);

  useEffect(() => {
    const loadMetadata = async () => {
      try { setMetadataError(null); const { sets, rarities } = await fetchMetadata(); setSets(sets); setRarities(rarities); } catch (err) { setMetadataError("Failed to load metadata."); }
    };
    loadMetadata();
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (initialRender.current) { initialRender.current = false; return; }
    if (debouncedQuery || filterSet || filterRarity || filterType) fetchCardsWrapper(1);
  }, [debouncedQuery, filterSet, filterRarity, filterType]);

  // --- HANDLER FUNCTIONS ---
  const fetchCardsWrapper = async (newPage = 1) => {
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    const signal = abortController.current.signal;
    setLoading(true); setError(null);
    try {
      const searchParams = { searchQuery: debouncedQuery, filterSet, filterRarity, filterType, page: newPage, limit: cardsPerPage };
      const responseData = await searchCards(searchParams, signal);
      const flatPrintings = responseData.data.printings || [];
      const groupedCards = groupPrintingsByCard(flatPrintings);
      setCards(groupedCards);
      const pagination = responseData.data.pagination || {};
      setTotalPages(pagination.totalPages || Math.ceil((responseData.data.total || 0) / cardsPerPage));
      setTotalCards(responseData.data.total || 0);
      setPage(newPage); setHasSearched(true);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") { setError(err.message); setCards([]); }
    } finally { setLoading(false); }
  };

  const handleBulkSearch = async (e: React.FormEvent) => {
    e.preventDefault(); setBulkLoading(true); setBulkError(null); setBulkResults([]);
    try {
      const parsed = parseBulkInput(bulkInput, bulkImportSource);
      const cardMap = new Map();
      for (const card of parsed) {
          const key = `${card.name.toLowerCase()}|${card.color || ""}`;
          const existing = cardMap.get(key);
          if (existing) existing.quantity += card.quantity || 1;
          else cardMap.set(key, { ...card });
      }
      const uniqueCards = Array.from(cardMap.values());
      const allResults: any[] = [];
      for (const card of uniqueCards) {
        let url;
        if ((bulkImportSource === 'fabrary' || bulkImportSource === 'fabtcg') && card.color !== undefined) {
            url = `/api/printings/search?name=${encodeURIComponent(card.name)}&color=${encodeURIComponent(card.color || "")}&limit=20&show=summary`;
        } else {
            url = `/api/printings/search?searchableText=${encodeURIComponent(card.name)}&limit=20&show=summary`;
        }
        const response = await fetch(url);
        if (response.ok) {
            const responseData = await response.json();
            if (responseData.success && responseData.data.printings) {
                let matches = responseData.data.printings;
                if (bulkImportSource === 'cardlist') matches = matches.filter((p: any) => p.name?.toLowerCase() === card.name.toLowerCase());
                const matchesWithQuantity = matches.map((p: any) => ({ ...p, importQuantity: card.quantity || 1 }));
                allResults.push(...matchesWithQuantity);
            }
        }
      }
      const groupedCards = groupPrintingsByCard(allResults);
      setBulkResults(groupedCards);
    } catch (err: any) { setBulkError(err.message || "Bulk search failed");
    } finally { setBulkLoading(false); }
  };
  
  const handleAddToPending = (card: any, printing: any, quantity: number, forTrade: boolean = true) => {
    setPendingImport(prev => {
        const cardId = card.card_unique_id;
        const printingId = printing?.printing_id;
        const idx = prev.findIndex(c => c.cardId === cardId && c.printingId === printingId);
        if (idx !== -1) return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + quantity } : item);
        return [...prev, { id: printingId, cardId, name: card.name, quantity, printingId, printingDetails: { ...printing }, set: printing?.set_id, rarity: printing?.rarity, foiling: printing?.foiling, forTrade }];
    });
  };

  const handleAddToWants = async (card: any, printing: any, quantity: number = 1) => {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    try { await addToWantsList(printing?.printing_id, quantity, 'medium', ''); toast({ title: "Added to wants list!", description: `${quantity}x ${card.name}` });
    } catch (error: any) { toast({ title: "Error", description: "Failed to add to wants list.", variant: "destructive" }); }
  };
  
  const incrementPending = (card: any) => setPendingImport(prev => prev.map(c => c === card ? { ...c, quantity: c.quantity + 1 } : c));
  const decrementPending = (card: any) => setPendingImport(prev => prev.flatMap(c => c === card ? (c.quantity > 1 ? [{ ...c, quantity: c.quantity - 1 }] : []) : [c]));
  const removePending = (card: any) => setPendingImport(prev => prev.filter(c => c !== card));
  const clearPending = () => setPendingImport([]);

  const handleImportToBinder = async () => {
    if (!user || !pendingImport.length || !selectedBinderId) return;
    setCreatingBinder(true);
    try {
        const selectedBinder = userBinders.find(b => b._id === selectedBinderId);
        if (!selectedBinder) throw new Error("Selected binder not found");
        const printingsToAdd = pendingImport.map(card => ({ printingId: card.printingId, quantity: card.quantity, condition: "NM", forTrade: card.forTrade, notes: "" }));
        const addResult = await addCardsToBinder(selectedBinder.slug, printingsToAdd);
        const wantsMsg = formatWantsRemoved(addResult?.wantsRemoved);
        toast({ title: "Import successful!", description: wantsMsg ?? undefined, variant: "default" }); setPendingImport([]);
    } catch (err: any) { toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally { setCreatingBinder(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchCardsWrapper(1); };
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= totalPages) fetchCardsWrapper(newPage); };
  const handleClearFilters = () => { setSearchQuery(""); setDebouncedQuery(""); setFilterSet(""); setFilterRarity(""); setFilterType(""); setHasSearched(false); setCards([]); };

  // --- START OF FULLY IMPLEMENTED FUNCTIONS ---
  const handleImportToDeck = async () => {
    if (!user) return toast({ title: "Login required", variant: "destructive" });
    await handleDeckImport(pendingImport, selectedDeckId, userDecks, toast, { setCreatingBinder, setImportSuccess, setCreatedDeckId, setPendingImport });
  };

  const handleImportToNewDeck = async () => {
    if (!user) return toast({ title: "Login required", variant: "destructive" });
    const deckName = newDeckName.trim() || getDefaultDeckName();
    await handleNewDeckImport(pendingImport, deckName, newDeckFormat, toast, { setCreatingBinder, setImportSuccess, setCreatedDeckId, setPendingImport, setUserDecks });
  };

  const handleCreateNewBinder = async () => {
    if (!user || !newBinderName.trim()) return;
    try {
        const binder = await createBinder(user.id, newBinderName.trim());
        setUserBinders(prev => [...prev, binder]);
        setSelectedBinderId(binder._id);
        setShowNewBinderPrompt(false); setNewBinderName("");
        toast({ title: "Binder created" });
    } catch (err: any) { toast({ title: "Error creating binder", variant: "destructive" }); }
  };

  const handleCreateNewDeck = async () => {
    if (!user || !newDeckName.trim()) return;
    try {
        const newDeck = await createDeck(newDeckName.trim(), newDeckFormat, false);
        setUserDecks(prev => [...prev, newDeck]);
        setSelectedDeckId(newDeck._id);
        setShowNewDeckPrompt(false); setNewDeckName("");
        toast({ title: "Deck created" });
    } catch (err: any) { toast({ title: "Error creating deck", variant: "destructive" }); }
  };
  // --- END OF FULLY IMPLEMENTED FUNCTIONS ---

  return {
    state: {
      searchQuery, debouncedQuery, filterSet, filterRarity, cards, loading, error, page, totalPages, totalCards, hasSearched, importMode, userDecks, selectedDeckId, showNewDeckPrompt, newDeckName, newDeckFormat, sets, rarities, metadataError, mode, bulkInput, bulkResults, bulkLoading, bulkError, bulkImportSource, creatingBinder, importSuccess, pendingImport, userBinders, selectedBinderId, showNewBinderPrompt, newBinderName, showImportConfirm, singleSelections
    },
    handlers: {
      setSearchQuery, setFilterSet, setFilterRarity, handleSearch, handlePageChange, handleClearFilters, setImportMode, setSelectedDeckId, setShowNewDeckPrompt, setNewDeckName, setNewDeckFormat, handleCreateNewDeck, setMode, setBulkInput, handleBulkSearch, setBulkImportSource, handleAddToPending, handleAddToWants, incrementPending, decrementPending, removePending, clearPending, handleImportToBinder, handleImportToDeck, handleImportToNewDeck, setSelectedBinderId, setShowNewBinderPrompt, setNewBinderName, handleCreateNewBinder, setShowImportConfirm, setSingleSelections
    }
  };
}
"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface SelectedCard {
  printing: any;
  quantity: number;
}

export function useSearchSelection() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Map of printing_id to {printing, quantity}
  const [selectedCards, setSelectedCards] = useState<Map<string, SelectedCard>>(new Map());
  const [binders, setBinders] = useState<any[]>([]);
  const [selectedBinderSlug, setSelectedBinderSlug] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);

  // Fetch user binders
  useEffect(() => {
    const fetchUserBinders = async () => {
      if (!user) {
        setBinders([]);
        return;
      }
      try {
        const response = await fetch(`/api/users/${user.id}/binders/summary`);
        if (!response.ok) throw new Error("Failed to fetch binders");
        const data = await response.json();
        setBinders(data.binders || []);
        if (data.binders && data.binders.length > 0) {
          setSelectedBinderSlug(data.binders[0].slug);
        }
      } catch (err) {
        console.error("Error fetching binders:", err);
        setBinders([]);
      }
    };
    fetchUserBinders();
  }, [user]);

  // Toggle card selection
  const toggleCardSelection = (printing: any) => {
    setSelectedCards(prev => {
      const newMap = new Map(prev);
      const printingId = printing.printing_id;

      if (newMap.has(printingId)) {
        newMap.delete(printingId);
      } else {
        newMap.set(printingId, { printing, quantity: 1 });
      }

      return newMap;
    });
  };

  // Update quantity for a selected card
  const updateQuantity = (printingId: string, quantity: number) => {
    setSelectedCards(prev => {
      const newMap = new Map(prev);
      const card = newMap.get(printingId);

      if (card) {
        newMap.set(printingId, { ...card, quantity: Math.max(1, quantity) });
      }

      return newMap;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedCards(new Map());
    toast({ title: "Selection Cleared" });
  };

  // Check if a card is selected
  const isCardSelected = (printingId: string): boolean => {
    return selectedCards.has(printingId);
  };

  // Get quantity for a card
  const getCardQuantity = (printingId: string): number => {
    return selectedCards.get(printingId)?.quantity || 1;
  };

  // Create new binder
  const handleCreateBinder = async (name: string, slug: string, visibility: any) => {
    if (!user) {
      toast({ title: "Login Required", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/binders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, visibility })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create binder");

      const newBinder = data.binder;
      setBinders(current => [...current, newBinder]);
      setSelectedBinderSlug(newBinder.slug);
      toast({ title: "Binder Created!", description: `"${name}" has been added.` });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Creation Error", description: errorMessage, variant: "destructive" });
    }
  };

  // Add selected cards to binder
  const handleAddToBinder = async () => {
    if (selectedCards.size === 0 || !selectedBinderSlug) {
      toast({
        title: "No Cards Selected",
        description: "Select cards using the checkboxes first.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      const selectedBinder = binders.find(b => b.slug === selectedBinderSlug);
      if (!selectedBinder) {
        throw new Error("Selected binder not found");
      }

      const printingsPayload = Array.from(selectedCards.values()).map(({ printing, quantity }) => ({
        printingId: printing.printing_id,
        quantity,
        forTrade: true,
        condition: 'NM',
        notes: ''
      }));

      const response = await fetch(`/api/binders/${selectedBinder._id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printings: printingsPayload })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add cards.");
      }

      toast({
        title: "Import Successful!",
        description: `${data.summary.added} cards added, ${data.summary.updated} updated, ${data.summary.failed} failed.`
      });

      // Clear selection after successful import
      setSelectedCards(new Map());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Import Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  // Add selected cards to wants list
  const handleAddToWants = async () => {
    if (selectedCards.size === 0) {
      toast({
        title: "No Cards Selected",
        description: "Select cards using the checkboxes first.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      const printingsPayload = Array.from(selectedCards.values()).map(({ printing, quantity }) => ({
        printingId: printing.printing_id,
        quantity,
        priority: 'medium'
      }));

      const response = await fetch('/api/wants/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printings: printingsPayload })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add to wants list.");
      }

      toast({ title: "Wants List Updated!" });

      // Clear selection after successful import
      setSelectedCards(new Map());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Wants List Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return {
    selectedCards,
    selectedCount: selectedCards.size,
    binders,
    selectedBinderSlug,
    isImporting,
    toggleCardSelection,
    updateQuantity,
    clearSelection,
    isCardSelected,
    getCardQuantity,
    setSelectedBinderSlug,
    handleCreateBinder,
    handleAddToBinder,
    handleAddToWants,
  };
}

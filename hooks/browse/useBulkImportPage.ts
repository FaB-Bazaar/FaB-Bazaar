"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { parseBulkInput } from '@/lib/browse/parsers/bulk-input-parser';
import { selectDefaultPrinting } from '@/lib/browse/utils';
import { getSetName } from "@/lib/fab-formatters";
import { bindersClient, wantsClient, searchClient } from "@/lib/client";
import type { BulkSearchCard } from "@/lib/client/search-client";

const groupPrintingsByCard = (printings: any[], key: string) => {
  if (!printings || printings.length === 0) return new Map();
  const cardMap = new Map<string, any[]>();
  printings.forEach(p => {
    const groupKey = p[key];
    if (groupKey) {
      if (!cardMap.has(groupKey)) cardMap.set(groupKey, []);
      cardMap.get(groupKey)!.push(p);
    }
  });
  return cardMap;
};

export function useBulkImportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [binders, setBinders] = useState<any[]>([]);
  const [selectedBinderSlug, setSelectedBinderSlug] = useState<string>("");
  
  useEffect(() => {
    const fetchUserBinders = async () => {
      if (!user) { setBinders([]); return; }
      try {
        const result = await bindersClient.getUserBinders();
        if (result.success) {
          setBinders(result.data.binders || []);
          if (result.data.binders && result.data.binders.length > 0) {
            setSelectedBinderSlug(result.data.binders[0].slug);
          }
        } else {
          throw new Error(result.error || "Failed to fetch binders");
        }
      } catch (err) { console.error("Error fetching binders:", err); setBinders([]); }
    };
    fetchUserBinders();
  }, [user]);

  const handleBulkSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const parsedCards = parseBulkInput(bulkInput, 'cardlist');
      if (parsedCards.length === 0) throw new Error("Input is empty or could not be parsed.");

      // Single request + single DB query for all cards
      const bulkCards: BulkSearchCard[] = parsedCards.map(card => ({
        name: card.name,
        color: card.color || undefined,
        exact: !card.isPartialMatch,
        isPartialMatch: card.isPartialMatch,
        foiling: card.foiling || undefined,
        set: card.set || undefined,
        edition: card.edition || undefined,
      }));

      const bulkResponse = await searchClient.bulkSearchByNames(bulkCards);
      if (!bulkResponse.success) throw new Error(bulkResponse.error || "Bulk search failed.");

      const allPrintings: any[] = [];
      bulkResponse.data.results.forEach((result, index) => {
        if (result.printings.length > 0) {
          const originalCard = parsedCards[index];
          const printingsWithQuantity = result.printings.map((p: any) => ({ ...p, importQuantity: originalCard.quantity }));
          allPrintings.push(...printingsWithQuantity);
        }
      });
      
      if (allPrintings.length === 0) throw new Error("No cards found for your query.");

      const groupedByCard = groupPrintingsByCard(allPrintings, 'card_unique_id');
      
      const newCardInstances = Array.from(groupedByCard.entries()).map(([cardUniqueId, printings]) => ({
        instanceId: `${cardUniqueId}-${Date.now()}-${Math.random()}`,
        card_unique_id: cardUniqueId,
        selectedPrinting: selectDefaultPrinting({ printings }),
        quantity: printings[0].importQuantity,
        forTrade: false,
        allPrintings: printings,
        isStaged: false, // Default to NOT being in the sidebar
      }));

      let addedCount = 0;
      let updatedCount = 0;

      setBulkResults(currentResults => {
        const newCardUniqueIds = new Set(newCardInstances.map(c => c.card_unique_id));
        
        // Keep all existing staged cards
        const existingStagedCards = currentResults.filter(card => card.isStaged);

        // Filter out non-staged cards that will be explicitly replaced/updated by new search results
        // Also keep non-staged cards if their card_unique_id is not present in the new search
        const nonStagedKeepers = currentResults.filter(card => 
          !card.isStaged && !newCardUniqueIds.has(card.card_unique_id)
        );
        
        const nextBulkResults = [...existingStagedCards, ...nonStagedKeepers];
        
        newCardInstances.forEach(newCard => {
            // Check if we have an existing *non-staged* card with the same card_unique_id
            const existingNonStagedCardIndex = nextBulkResults.findIndex(
                card => !card.isStaged && card.card_unique_id === newCard.card_unique_id
            );

            if (existingNonStagedCardIndex !== -1) {
                // If a non-staged card with the same unique ID exists, update its quantity and printing
                nextBulkResults[existingNonStagedCardIndex] = {
                    ...nextBulkResults[existingNonStagedCardIndex],
                    quantity: nextBulkResults[existingNonStagedCardIndex].quantity + newCard.quantity,
                    selectedPrinting: newCard.selectedPrinting,
                    allPrintings: newCard.allPrintings,
                };
                updatedCount++;
            } else {
                // Otherwise, add it as a new distinct card
                nextBulkResults.push(newCard);
                addedCount++;
            }
        });
        
        // Sort the results: staged cards first, then non-staged, by display name
        return nextBulkResults.sort((a, b) => {
            if (a.isStaged && !b.isStaged) return -1;
            if (!a.isStaged && b.isStaged) return 1;
            return (a.selectedPrinting?.display_name || '').localeCompare(b.selectedPrinting?.display_name || '');
        });
      });

      setBulkInput(""); // Clear input for the next search
      toast({ title: "Search Complete", description: `${addedCount} new card(s) added, ${updatedCount} existing card(s) updated.` });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Search Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBinder = async (name: string, slug: string, visibility: any) => {
    if (!user) { toast({ title: "Login Required", variant: "destructive" }); return; }
    try {
      const result = await bindersClient.createBinder({ name, slug, visibility });
      if (result.success) {
        const newBinder = result.data;
        setBinders(current => [...current, newBinder]);
        setSelectedBinderSlug(newBinder.slug);
        toast({ title: "Binder Created!", description: `"${name}" has been added.` });
      } else {
        throw new Error(result.error || "Failed to create binder");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Creation Error", description: errorMessage, variant: "destructive" });
    }
  };
  
  const handleAddToBinder = async () => {
    const stagedCards = bulkResults.filter(c => c.isStaged);
    if (stagedCards.length === 0 || !selectedBinderSlug) {
      toast({ title: "No Staged Cards", description: "Stage cards using the button on the card tiles first.", variant: "destructive"});
      return;
    }

    setIsImporting(true);
    try {
      const selectedBinder = binders.find(b => b.slug === selectedBinderSlug);
      if (!selectedBinder) {
        throw new Error("Selected binder not found");
      }

      const cardsPayload = stagedCards.map(instance => ({
        printingId: instance.selectedPrinting.printing_id,
        quantity: instance.quantity,
        forTrade: instance.forTrade,
        condition: 'NM',
        notes: ''
      }));

      const result = await bindersClient.addCardsToBinder(selectedBinder._id, cardsPayload);

      if (result.success) {
        toast({
          title: "Import Successful!",
          description: `${result.data.summary.added} cards added, ${result.data.summary.updated} updated, ${result.data.summary.failed} failed.`
        });
        setBulkResults(current => current.filter(c => !c.isStaged));
      } else {
        throw new Error(result.error || "Failed to add cards.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Import Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddToWants = async () => {
    const stagedCards = bulkResults.filter(c => c.isStaged);
    if (stagedCards.length === 0) {
      toast({ title: "No Staged Cards", description: "Stage cards using the button on the card tiles first.", variant: "destructive"});
      return;
    }
    setIsImporting(true);
    try {
      const itemsPayload = stagedCards.map(instance => ({
        printingId: instance.selectedPrinting.printing_id,
        quantity: instance.quantity,
        priority: 'medium' as const
      }));

      const result = await wantsClient.bulkAddWants(itemsPayload);

      if (result.success) {
        toast({ title: "Wants List Updated!" });
        setBulkResults(current => current.filter(c => !c.isStaged));
      } else {
        throw new Error(result.error || "Failed to add to wants list.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Wants List Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleStagedStatus = (instanceId: string) => {
    setBulkResults(current => current.map(card => 
      card.instanceId === instanceId ? { ...card, isStaged: !card.isStaged } : card
    ));
  };
  
  const clearStaged = () => {
    setBulkResults(current => current.map(card => ({ ...card, isStaged: false })));
    toast({ title: "Import List Cleared" });
  };
  
  const updateCardQuantity = (instanceId: string, newQuantity: number) => { setBulkResults(current => current.map(card => card.instanceId === instanceId ? { ...card, quantity: Math.max(1, newQuantity) } : card)); };
  const toggleForTrade = (instanceId: string) => { setBulkResults(current => current.map(card => card.instanceId === instanceId ? { ...card, forTrade: !card.forTrade } : card)); };

  const setAllStagedForTrade = (value: boolean) => {
    const stagedCount = bulkResults.filter(c => c.isStaged).length;

    setBulkResults(current =>
      current.map(card =>
        card.isStaged ? { ...card, forTrade: value } : card
      )
    );

    toast({
      title: value ? "Marked All For Trade" : "Marked All Not For Trade",
      description: `${stagedCount} staged card(s) updated.`
    });
  };

  const removeCard = (instanceId: string) => { setBulkResults(current => current.filter(card => card.instanceId !== instanceId)); toast({ title: "Card Removed" }); };
  
  const duplicateCard = (instanceId: string): any | null => { 
    let newInstance: any|null=null; 
    setBulkResults(current => {
      const cardToDuplicate = current.find(c => c.instanceId === instanceId);
      if (!cardToDuplicate) return current;
      
      newInstance = {
        ...cardToDuplicate,
        instanceId: `${cardToDuplicate.card_unique_id}-${Date.now()}-${Math.random()}`, // Ensure new unique instanceId
        quantity: 1, // Start duplicate with quantity 1
        isStaged: false, // Duplicates should not be staged by default
      };
      
      const insertIndex = current.findIndex(c => c.instanceId === instanceId);
      const newResults = [...current];
      // Insert the new instance right after the original
      newResults.splice(insertIndex + 1, 0, newInstance);
      return newResults;
    }); 
    toast({title:"Card Duplicated",description:"Select a different printing for the new copy if needed."}); 
    return newInstance; 
  };

  const updateCardPrinting = (instanceId: string, newPrinting: any) => { 
    setBulkResults(current => current.map(card => {
      if (card.instanceId === instanceId) {
        return { ...card, selectedPrinting: newPrinting };
      }
      return card;
    })); 
    toast({title:"Printing Updated",description:`Switched to ${getSetName(newPrinting.set||newPrinting.set_id)}.`}); 
  };

  return {
    state: {
      bulkInput, bulkResults, loading, error, isImporting,
      binders,
      selectedBinderSlug,
    },
    handlers: {
      setBulkInput, handleBulkSearch, updateCardPrinting,
      updateCardQuantity, toggleForTrade, removeCard, duplicateCard,
      handleAddToBinder, handleAddToWants,
      setSelectedBinderSlug,
      handleCreateBinder,
      toggleStagedStatus,
      clearStaged,
      setAllStagedForTrade,
    }
  };
}

// "use client";

// import { useState, useEffect } from "react";
// import { useToast } from "@/hooks/use-toast";
// import { useAuth } from "@/contexts/AuthContext"; 
// import { parseBulkInput } from '@/lib/browse/parsers/bulk-input-parser';
// import { selectDefaultPrinting } from '@/lib/browse/utils';
// import { getSetName } from "@/lib/fab-formatters";

// const groupPrintingsByCard = (printings: any[], key: string) => {
//   if (!printings || printings.length === 0) return new Map();
//   const cardMap = new Map<string, any[]>();
//   printings.forEach(p => {
//     const groupKey = p[key];
//     if (groupKey) {
//       if (!cardMap.has(groupKey)) cardMap.set(groupKey, []);
//       cardMap.get(groupKey)!.push(p);
//     }
//   });
//   return cardMap;
// };

// export function useBulkImportPage() {
//   const { toast } = useToast();
//   const { user } = useAuth();
  
//   const [bulkInput, setBulkInput] = useState("");
//   const [bulkResults, setBulkResults] = useState<any[]>([]); 
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [isImporting, setIsImporting] = useState(false);
//   const [binders, setBinders] = useState<any[]>([]);
//   const [selectedBinderSlug, setSelectedBinderSlug] = useState<string>("");
  
//   useEffect(() => {
//     const fetchUserBinders = async () => {
//       if (!user) { setBinders([]); return; }
//       try {
//         const response = await fetch(`/api/users/${user.id}/binders/summary`);
//         if (!response.ok) throw new Error("Failed to fetch binders");
//         const data = await response.json();
//         setBinders(data.binders || []);
//         if (data.binders && data.binders.length > 0) {
//           setSelectedBinderSlug(data.binders[0].slug);
//         }
//       } catch (err) { console.error("Error fetching binders:", err); setBinders([]); }
//     };
//     fetchUserBinders();
//   }, [user]);

//   const handleBulkSearch = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     try {
//       const parsedCards = parseBulkInput(bulkInput, 'cardlist');
//       if (parsedCards.length === 0) throw new Error("Input is empty or could not be parsed.");

//       const apiCallPromises = parsedCards.map(card => {
//         const filters: any = { name: card.name };
//         if (!card.isPartialMatch) {
//           filters.exact = true;
//         }
//         if (card.color) {
//           filters.color = card.color;
//         }
//         const options = { limit: 50, show: 'browse_bulk' as const };
//         return fetch(`/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters, options }) })
//           .then(res => res.ok ? res.json() : { success: false });
//       });

//       const allResponses = await Promise.all(apiCallPromises);
//       const allPrintings: any[] = [];
//       allResponses.forEach((response, index) => {
//         if (response.success && response.data?.printings) {
//           const originalCard = parsedCards[index];
//           const printingsWithQuantity = response.data.printings.map((p: any) => ({ ...p, importQuantity: originalCard.quantity }));
//           allPrintings.push(...printingsWithQuantity);
//         }
//       });
      
//       if (allPrintings.length === 0) throw new Error("No cards found for your query.");

//       const groupedByCard = groupPrintingsByCard(allPrintings, 'card_unique_id');
      
//       const newCardInstances = Array.from(groupedByCard.entries()).map(([cardUniqueId, printings]) => ({
//         instanceId: `${cardUniqueId}-${Date.now()}-${Math.random()}`,
//         card_unique_id: cardUniqueId,
//         selectedPrinting: selectDefaultPrinting({ printings }),
//         quantity: printings[0].importQuantity,
//         forTrade: true,
//         allPrintings: printings,
//         isStaged: false, // Default to NOT being in the sidebar
//       }));

//       let addedCount = 0;
//       let updatedCount = 0;

//       setBulkResults(currentResults => {
//         const newCardUniqueIds = new Set(newCardInstances.map(c => c.card_unique_id));
        
//         // Keep all existing staged cards
//         const existingStagedCards = currentResults.filter(card => card.isStaged);

//         // Filter out non-staged cards that will be explicitly replaced/updated by new search results
//         // Also keep non-staged cards if their card_unique_id is not present in the new search
//         const nonStagedKeepers = currentResults.filter(card => 
//           !card.isStaged && !newCardUniqueIds.has(card.card_unique_id)
//         );
        
//         const nextBulkResults = [...existingStagedCards, ...nonStagedKeepers];
        
//         newCardInstances.forEach(newCard => {
//             // Check if we have an existing *non-staged* card with the same card_unique_id
//             const existingNonStagedCardIndex = nextBulkResults.findIndex(
//                 card => !card.isStaged && card.card_unique_id === newCard.card_unique_id
//             );

//             if (existingNonStagedCardIndex !== -1) {
//                 // If a non-staged card with the same unique ID exists, update its quantity and printing
//                 nextBulkResults[existingNonStagedCardIndex] = {
//                     ...nextBulkResults[existingNonStagedCardIndex],
//                     quantity: nextBulkResults[existingNonStagedCardIndex].quantity + newCard.quantity,
//                     selectedPrinting: newCard.selectedPrinting,
//                     allPrintings: newCard.allPrintings,
//                 };
//                 updatedCount++;
//             } else {
//                 // Otherwise, add it as a new distinct card
//                 nextBulkResults.push(newCard);
//                 addedCount++;
//             }
//         });
        
//         // Sort the results: staged cards first, then non-staged, by display name
//         return nextBulkResults.sort((a, b) => {
//             if (a.isStaged && !b.isStaged) return -1;
//             if (!a.isStaged && b.isStaged) return 1;
//             return (a.selectedPrinting?.display_name || '').localeCompare(b.selectedPrinting?.display_name || '');
//         });
//       });

//       setBulkInput(""); // Clear input for the next search
//       toast({ title: "Search Complete", description: `${addedCount} new card(s) added, ${updatedCount} existing card(s) updated.` });

//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
//       setError(errorMessage);
//       toast({ title: "Search Error", description: errorMessage, variant: "destructive" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCreateBinder = async (name: string, slug: string, visibility: any) => {
//     if (!user) { toast({ title: "Login Required", variant: "destructive" }); return; }
//     try {
//       const response = await fetch(`/api/users/${user.id}/binders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug, visibility }) });
//       const data = await response.json();
//       if (!response.ok) throw new Error(data.error || "Failed to create binder");
//       const newBinder = data.binder;
//       setBinders(current => [...current, newBinder]);
//       setSelectedBinderSlug(newBinder.slug);
//       toast({ title: "Binder Created!", description: `"${name}" has been added.` });
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
//       toast({ title: "Creation Error", description: errorMessage, variant: "destructive" });
//     }
//   };
  
//   const handleAddToBinder = async () => {
//   const stagedCards = bulkResults.filter(c => c.isStaged);
//   if (stagedCards.length === 0 || !selectedBinderSlug) {
//     toast({ title: "No Staged Cards", description: "Stage cards using the button on the card tiles first.", variant: "destructive"});
//     return;
//   }
  
//   setIsImporting(true);
//   try {
//     const selectedBinder = binders.find(b => b.slug === selectedBinderSlug);
//     if (!selectedBinder) {
//       throw new Error("Selected binder not found");
//     }

//     const printingsPayload = stagedCards.map(instance => ({ 
//       printingId: instance.selectedPrinting.printing_id, 
//       quantity: instance.quantity, 
//       forTrade: instance.forTrade,
//       condition: 'NM', // Default condition
//       notes: '' // Default notes
//     }));

//     const response = await fetch(`/api/binders/${selectedBinder._id}/cards`, { 
//       method: 'POST', 
//       headers: { 'Content-Type': 'application/json' }, 
//       body: JSON.stringify({ printings: printingsPayload }) 
//     });

//     const data = await response.json();
//     if (!response.ok || !data.success) throw new Error(data.error || "Failed to add cards.");
    
//     toast({ 
//       title: "Import Successful!", 
//       description: `${data.summary.added} cards added, ${data.summary.updated} updated, ${data.summary.failed} failed.` 
//     });
    
//     setBulkResults(current => current.filter(c => !c.isStaged)); // Remove staged cards from the list
//   } catch (err) {
//     const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
//     toast({ title: "Import Error", description: errorMessage, variant: "destructive" });
//   } finally { 
//     setIsImporting(false); 
//   }
// };

//   const handleAddToWants = async () => {
//     const stagedCards = bulkResults.filter(c => c.isStaged);
//     if (stagedCards.length === 0) {
//       toast({ title: "No Staged Cards", description: "Stage cards using the button on the card tiles first.", variant: "destructive"});
//       return;
//     }
//     setIsImporting(true);
//     try {
//       const printingsPayload = stagedCards.map(instance => ({ printingId: instance.selectedPrinting.printing_id, quantity: instance.quantity, priority: 'medium' }));
//       const response = await fetch('/api/wants/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ printings: printingsPayload }) });
//       const data = await response.json();
//       if (!response.ok || !data.success) throw new Error(data.error || "Failed to add to wants list.");
//       toast({ title: "Wants List Updated!" });
//       setBulkResults(current => current.filter(c => !c.isStaged)); // Remove staged cards from the list
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
//       toast({ title: "Wants List Error", description: errorMessage, variant: "destructive" });
//     } finally { setIsImporting(false); }
//   };

//   const toggleStagedStatus = (instanceId: string) => {
//     setBulkResults(current => current.map(card => 
//       card.instanceId === instanceId ? { ...card, isStaged: !card.isStaged } : card
//     ));
//   };
  
//   const clearStaged = () => {
//     setBulkResults(current => current.map(card => ({ ...card, isStaged: false })));
//     toast({ title: "Import List Cleared" });
//   };
  
//   const updateCardQuantity = (instanceId: string, newQuantity: number) => { setBulkResults(current => current.map(card => card.instanceId === instanceId ? { ...card, quantity: Math.max(1, newQuantity) } : card)); };
//   const toggleForTrade = (instanceId: string) => { setBulkResults(current => current.map(card => card.instanceId === instanceId ? { ...card, forTrade: !card.forTrade } : card)); };
//   const removeCard = (instanceId: string) => { setBulkResults(current => current.filter(card => card.instanceId !== instanceId)); toast({ title: "Card Removed" }); };
  
//   const duplicateCard = (instanceId: string): any | null => { 
//     let newInstance: any|null=null; 
//     setBulkResults(current => {
//       const cardToDuplicate = current.find(c => c.instanceId === instanceId);
//       if (!cardToDuplicate) return current;
      
//       newInstance = {
//         ...cardToDuplicate,
//         instanceId: `${cardToDuplicate.card_unique_id}-${Date.now()}-${Math.random()}`, // Ensure new unique instanceId
//         quantity: 1, // Start duplicate with quantity 1
//         isStaged: false, // Duplicates should not be staged by default
//       };
      
//       const insertIndex = current.findIndex(c => c.instanceId === instanceId);
//       const newResults = [...current];
//       // Insert the new instance right after the original
//       newResults.splice(insertIndex + 1, 0, newInstance);
//       return newResults;
//     }); 
//     toast({title:"Card Duplicated",description:"Select a different printing for the new copy if needed."}); 
//     return newInstance; 
//   };

//   const updateCardPrinting = (instanceId: string, newPrinting: any) => { 
//     setBulkResults(current => current.map(card => {
//       if (card.instanceId === instanceId) {
//         return { ...card, selectedPrinting: newPrinting };
//       }
//       return card;
//     })); 
//     toast({title:"Printing Updated",description:`Switched to ${getSetName(newPrinting.set||newPrinting.set_id)}.`}); 
//   };

//   return {
//     state: {
//       bulkInput, bulkResults, loading, error, isImporting,
//       binders,
//       selectedBinderSlug,
//     },
//     handlers: {
//       setBulkInput, handleBulkSearch, updateCardPrinting,
//       updateCardQuantity, toggleForTrade, removeCard, duplicateCard,
//       handleAddToBinder, handleAddToWants,
//       setSelectedBinderSlug,
//       handleCreateBinder,
//       toggleStagedStatus, 
//       clearStaged,      
//     }
//   };
// }

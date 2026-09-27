"use client";

// Add-to-binder / add-to-wants for deck card grids (collector mode + tile
// buttons): loads the signed-in user's binders, remembers the chosen binder
// (localStorage "selectedBinderId"), and adds one copy with a toast. Shared by
// the classic deck page and deck v2 (moved verbatim from the classic page).

import { useEffect, useState } from "react";
import { bindersClient, wantsClient } from "@/lib/client";
import { formatWantsRemoved } from "@/lib/wants/format-wants-removed";
import { useToast } from "@/hooks/use-toast";

export function useBinderWantsActions({ user, refreshDeck, refreshWants }: {
  user: unknown;
  refreshDeck: () => Promise<unknown>;
  refreshWants: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [binders, setBinders] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string>("");

  // Fetch binders when user is available
  useEffect(() => {
    if (!user) return;
    bindersClient.getUserBinders().then(result => {
      if (result.success) {
        const list = result.data.binders || [];
        setBinders(list);
        const stored = localStorage.getItem("selectedBinderId");
        if (stored && list.some((b: any) => b._id === stored)) {
          setSelectedBinderId(stored);
        } else if (list.length > 0) {
          setSelectedBinderId(list[0]._id);
        }
      }
    });
  }, [user]);

  const handleBinderChange = (binderId: string) => {
    setSelectedBinderId(binderId);
    localStorage.setItem("selectedBinderId", binderId);
  };

  const handleAddToBinder = async (printingId: string, cardName: string) => {
    if (!selectedBinderId) {
      toast({ title: "No binder selected", description: "Select a binder in the deck legend first.", variant: "destructive" });
      return;
    }
    const result = await bindersClient.addCardsToBinder(selectedBinderId, [{ printingId, quantity: 1, condition: "NM" }]);
    if (result.success) {
      const binderName = binders.find(b => b._id === selectedBinderId)?.name || "binder";
      const wantsMsg = formatWantsRemoved(result.data?.wantsRemoved);
      toast({ title: "Added to binder", description: `${cardName} → ${binderName}${wantsMsg ? `. ${wantsMsg}` : ''}` });
      await refreshDeck();
      // Adding to a binder can auto-remove matching wants rows
      await refreshWants();
    } else {
      toast({ title: "Failed to add to binder", description: result.error, variant: "destructive" });
    }
  };

  const handleAddToWants = async (printingId: string, cardName: string) => {
    const result = await wantsClient.addWantsItem(printingId, 1, 'medium');
    if (result.success) {
      toast({ title: "Added to wants", description: cardName });
      await refreshWants();
    } else {
      toast({ title: "Failed to add to wants", description: result.error, variant: "destructive" });
    }
  };

  return { binders, selectedBinderId, handleBinderChange, handleAddToBinder, handleAddToWants };
}

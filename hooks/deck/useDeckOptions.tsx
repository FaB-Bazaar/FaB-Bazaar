"use client";

// Options ("More") menu for a deck page: copy list, export .txt, export image,
// stream overlay, settings (save + featured / system-deck toggles), update to
// owned printings, convert language — the handlers and the dialogs they open.
// Moved verbatim from the classic deck page so deck v2 shares it.

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { decksClient } from "@/lib/client";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { buildDeckExportText } from "@/lib/deck/deck-export-text";
import DeckUpgradePrintingsDialog from "@/components/deck/editor/DeckUpgradePrintingsDialog";
import DeckLanguageConversionDialog from "@/components/deck/editor/DeckLanguageConversionDialog";
import DeckExportImageDialog from "@/components/deck/editor/DeckExportImageDialog";
import DeckStreamOverlayDialog from "@/components/deck/editor/DeckStreamOverlayDialog";
import DeckSettings from "@/components/deck/DeckSettings";

export function useDeckOptions({ deck, deckId, canEdit, isOwner, refreshDeck }: {
  deck: DeckDTO | null;
  deckId: string;
  canEdit: boolean;
  isOwner: boolean;
  refreshDeck: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const state = { deck };
  const handlers = { refreshDeck };

  // Export/copy state
  const [copySuccess, setCopySuccess] = useState(false);

  // Export image (shareable PNG) dialog
  const [exportImageOpen, setExportImageOpen] = useState(false);
  // Stream overlay (OBS links + "use as my streaming deck") dialog
  const [streamOverlayOpen, setStreamOverlayOpen] = useState(false);

  // Deck settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const handleCopyList = () => {
    if (!state.deck) return;
    const text = buildDeckExportText(state.deck);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast({ title: "Copied!", description: "Deck list copied to clipboard." });
    });
  };

  const handleExportList = () => {
    if (!state.deck) return;
    const text = buildDeckExportText(state.deck);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.deck.name || "deck"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
    eventName: string | null;
    eventDate: string | null;
    placing: number | null;
    folder: string | null;
  }) => {
    setSettingsSaving(true);
    try {
      const result = await decksClient.updateDeck(deckId, {
        name: settings.name,
        description: settings.description,
        format: settings.format,
        heroName: settings.hero,
        visibility: settings.visibility,
        availableOnTalishar: settings.availableOnTalishar,
        metafyGuideId: settings.metafyGuideId,
        eventName: settings.eventName,
        eventDate: settings.eventDate,
        placing: settings.placing,
        folder: settings.folder,
      } as any);
      if (!result.success) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        throw new Error(result.error);
      }
      handlers.refreshDeck();
      toast({ title: "Settings saved" });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleFeatured = async (_id: string, value: boolean) => {
    const result = await decksClient.toggleFeatured(deckId, value);
    if (!result.success) {
      toast({ title: "Error", description: "Failed to update featured status.", variant: "destructive" });
      return;
    }
    handlers.refreshDeck();
  };

  const handleToggleSystemDeck = async (_id: string, value: boolean) => {
    const result = await decksClient.toggleSystemDeck(deckId, value);
    if (!result.success) {
      toast({ title: "Error", description: "Failed to update system deck status.", variant: "destructive" });
      return;
    }
    handlers.refreshDeck();
  };

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleUpgradePrintings = async () => {
    setShowUpgradeDialog(true);
  };

  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const handleConvertLanguage = async () => {
    setShowLanguageDialog(true);
  };

  const dialogs = (
    <>
      <DeckExportImageDialog open={exportImageOpen} onOpenChange={setExportImageOpen} deck={state.deck} />
      {canEdit && state.deck && (
        <DeckStreamOverlayDialog
          open={streamOverlayOpen}
          onOpenChange={setStreamOverlayOpen}
          deckPublicId={state.deck.publicId}
          visibility={state.deck.visibility}
        />
      )}
      {isOwner && state.deck && (
        <DeckSettings
          deck={{
            _id: deckId,
            name: state.deck.name,
            description: state.deck.description,
            format: state.deck.format,
            hero: state.deck.heroName,
            visibility: state.deck.visibility,
            isPublic: state.deck.visibility === 'public',
            availableOnTalishar: state.deck.availableOnTalishar,
            metafyGuideId: state.deck.metafyGuideId,
            eventName: state.deck.eventName,
            eventDate: state.deck.eventDate,
            placing: state.deck.placing,
            folder: state.deck.folder,
          }}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={handleSaveSettings}
          loading={settingsSaving}
          deckId={deckId}
          fullDeck={state.deck}
          isCurator={user?.isCurator || user?.isSuperAdmin}
          isSuperAdmin={user?.isSuperAdmin}
          featured={state.deck.featured}
          onToggleFeatured={handleToggleFeatured}
          isSystemDeck={state.deck.isSystemDeck}
          onToggleSystemDeck={handleToggleSystemDeck}
        />
      )}
      <DeckUpgradePrintingsDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        deckId={deckId}
        onApplied={handlers.refreshDeck}
      />

      <DeckLanguageConversionDialog
        open={showLanguageDialog}
        onOpenChange={setShowLanguageDialog}
        deckId={deckId}
        onApplied={handlers.refreshDeck}
      />
    </>
  );

  return {
    exportImageOpen, setExportImageOpen, setStreamOverlayOpen, setSettingsOpen,
    handleCopyList, handleExportList, handleUpgradePrintings, handleConvertLanguage,
    dialogs,
  };
}

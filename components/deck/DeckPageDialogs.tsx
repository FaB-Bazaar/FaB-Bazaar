"use client";
import DeckCardSearchDialog from "@/components/deck/DeckCardSearchDialog";
import DeckSettings from "@/components/deck/DeckSettings";
import PrintingSwapDialog from "@/components/dialogs/cards/printing-swap-dialog";
import DeckBulkImportDialog from "@/components/deck/DeckBulkImportDialog";
import PrintingComparisonDialog from "@/components/deck/PrintingComparisonDialog";
import { decksClient } from "@/lib/client";
import type { useDeckPage } from "@/hooks/deck/useDeckPage";
import type { Deck } from "@/hooks/deck/useDeckPage";

interface DeckPageDialogsProps {
  deckId: string;
  displayDeck: Deck;
  state: ReturnType<typeof useDeckPage>["state"];
  handlers: ReturnType<typeof useDeckPage>["handlers"];
}

export default function DeckPageDialogs({
  deckId,
  displayDeck,
  state,
  handlers,
}: DeckPageDialogsProps) {
  const {
    isCardSearchOpen,
    settingsOpen,
    saving,
    printingSwapOpen,
    swappingPrinting,
    bulkImportOpen,
    comparisonDialogOpen,
    comparingPrinting,
    comparingCardCopies,
    activeCategory,
    isMetafyPartner,
  } = state;

  const {
    setIsCardSearchOpen,
    setSettingsOpen,
    setPrintingSwapOpen,
    setBulkImportOpen,
    setComparisonDialogOpen,
    handleSaveSettings,
    handleAddPrintingToDeck,
    handleOptimisticSwap,
    handlePrintingSwapComplete,
    handleBulkImport,
    handleSwapPrintingFromComparison,
  } = handlers;

  return (
    <>
      <DeckCardSearchDialog
        open={isCardSearchOpen}
        onOpenChange={setIsCardSearchOpen}
        onSelectCard={handleAddPrintingToDeck}
        targetCategory={activeCategory}
        deckFormat={displayDeck.format}
        currentDeck={displayDeck}
      />

      <DeckSettings
        deck={{ ...displayDeck, hero: displayDeck.heroName }}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={handleSaveSettings}
        loading={saving}
        isMetafyPartner={isMetafyPartner}
        deckId={deckId}
        fullDeck={displayDeck}
      />

      {printingSwapOpen && swappingPrinting && (
        <PrintingSwapDialog
          open={printingSwapOpen}
          onOpenChange={setPrintingSwapOpen}
          currentPrinting={{
            printingId: swappingPrinting.printingId,
            cardUniqueId: swappingPrinting.printingDetails?.card_unique_id,
            cardName:
              swappingPrinting.printingDetails?.display_name ||
              swappingPrinting.printingDetails?.name ||
              "Card",
          }}
          onSwap={async (newPrinting) => {
            handleOptimisticSwap(swappingPrinting, newPrinting);
            const swapResult = await decksClient.swapPrinting(
              deckId,
              swappingPrinting.printingId,
              newPrinting.printing_id,
              swappingPrinting.category as any
            );
            return { success: swapResult.success, error: swapResult.success ? undefined : swapResult.error };
          }}
          onSwapComplete={() => handlePrintingSwapComplete(swappingPrinting.printingId, "")}
        />
      )}

      <DeckBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImport={handleBulkImport}
        deckFormat={displayDeck.format}
        currentDeck={displayDeck}
      />

      {comparingPrinting && comparingCardCopies.length > 0 && (
        <PrintingComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={setComparisonDialogOpen}
          deckCopies={comparingCardCopies.map(copy => ({
            _id: copy._id || "",
            printingId: copy.printingId,
            printingDetails: copy.printingDetails,
          }))}
          cardName={
            comparingPrinting.printingDetails?.display_name ||
            comparingPrinting.printingDetails?.name ||
            "Card"
          }
          cardUniqueId={comparingPrinting.printingDetails?.card_unique_id || ""}
          onSwapPrinting={handleSwapPrintingFromComparison}
        />
      )}
    </>
  );
}

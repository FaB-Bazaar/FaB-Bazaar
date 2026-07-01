// components/binder/BulkImportDialog.tsx
"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBulkImportPage } from "@/hooks/browse/useBulkImportPage";
import BulkImportForm from "@/components/browse/BulkImportForm";
import BulkResultsGrid from "@/components/browse/BulkResultsGrid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';
import { bindersClient } from "@/lib/client";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binderId: string;
  binderName: string;
  onCardsImported: () => void;
}

export default function BulkImportDialog({
  open,
  onOpenChange,
  binderId,
  binderName,
  onCardsImported
}: BulkImportDialogProps) {
  const { state, handlers } = useBulkImportPage();
  const [activeDialogInstanceId, setActiveDialogInstanceId] = React.useState<string | null>(null);

  const handlePrintingView = (instanceId: string) => {
    setActiveDialogInstanceId(instanceId);
  };

  const activeInstance = state.bulkResults.find(c => c.instanceId === activeDialogInstanceId);
  const stagedCards = state.bulkResults.filter(c => c.isStaged);
  const totalStagedQuantity = stagedCards.reduce((total, card) => total + (card.quantity || 0), 0);

  const handleImportToBinder = async () => {
    try {
      // Convert staged cards to the format expected by the binder API
      const cardsToAdd = stagedCards.map(card => ({
        printingId: card.selectedPrinting.printing_id,
        quantity: card.quantity,
        condition: 'NM',
        forTrade: true,
        notes: ''
      }));

      const result = await bindersClient.addCardsToBinder(binderId, cardsToAdd);

      if (result.success) {
        // Clear the staged cards and close dialog
        handlers.clearStaged();
        onCardsImported();
        onOpenChange(false);
      } else {
        throw new Error(result.error || 'Failed to add cards to binder');
      }
    } catch (error) {
      console.error('Failed to import cards:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Import Cards to {binderName}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <BulkImportForm
              bulkInput={state.bulkInput}
              onInputChange={handlers.setBulkInput}
              onSearch={handlers.handleBulkSearch}
              loading={state.loading}
            />

            {state.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Search Failed</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {totalStagedQuantity > 0 && (
              <div className="sticky top-0 z-10 p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Ready to import {totalStagedQuantity} card(s) to {binderName}
                </span>
                <Button 
                  onClick={handleImportToBinder} 
                  disabled={state.isImporting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {state.isImporting ? 'Importing...' : 'Import to Binder'}
                </Button>
              </div>
            )}
            
            <BulkResultsGrid
              cards={state.bulkResults}
              loading={state.loading}
              onUpdatePrinting={handlers.updateCardPrinting}
              onQuantityChange={handlers.updateCardQuantity}
              onToggleTrade={handlers.toggleForTrade}
              onDuplicate={handlers.duplicateCard}
              onRemove={handlers.removeCard}
              onToggleStaged={handlers.toggleStagedStatus}
              onPrintingView={handlePrintingView}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ViewPrintingsDialog
        open={!!activeDialogInstanceId}
        onOpenChange={(isOpen) => !isOpen && setActiveDialogInstanceId(null)}
        cardName={activeInstance?.selectedPrinting?.display_name || ''}
        cardUniqueId={activeInstance?.card_unique_id || ''}
        onSelectPrinting={(printing) => {
          if (activeInstance) {
            handlers.updateCardPrinting(activeInstance.instanceId, printing);
          }
        }}
      />
    </>
  );
}
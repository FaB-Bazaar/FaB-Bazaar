//browse/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle, Link2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBulkImportPage } from "@/hooks/browse/useBulkImportPage";
import { useSession } from "next-auth/react";
import {
  parseBrowsePrefillParams,
  computePrefillPlan,
  toCardListText,
  isPrefillReady,
  type PrefillPlan,
} from "@/lib/browse/import-url-prefill";
import { bindersClient, searchClient } from "@/lib/client";
import BulkImportForm from "@/components/browse/BulkImportForm";
import BulkResultsGrid from "@/components/browse/BulkResultsGrid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ImportActions from "@/components/browse/ImportActions";
import PendingImportSidebar from "@/components/browse/PendingImportSidebar";
import MobileStagedSheet from "@/components/browse/MobileStagedSheet";
import StagedFAB from "@/components/browse/StagedFAB";
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';


// Helper function to calculate total physical card count from staged items
const calculateTotalQuantity = (stagedCards: any[]): number => {
  return stagedCards.reduce((total, card) => total + (card.quantity || 0), 0);
};

function BrowsePageContent() {

  // Add this component after the AffiliateDisclosure component
const SuperSlamDisclosure = () => {
  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <img 
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/e252874d-eeb0-41b9-7d17-19c117f17e00/public"
            alt="Super Slam"
            className="h-8 w-auto flex-shrink-0"
          />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Super Slam cards will be available to add to your binder on the official set release date.
          </p>
        </div>
      </div>
    </div>
  )
}

  const { state, handlers } = useBulkImportPage();
  const [activeDialogInstanceId, setActiveDialogInstanceId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── URL prefill (?cards=talishar_id,…&binder=slug) ─────────────────────────
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { status: sessionStatus } = useSession();
  const prefill = useMemo(
    () => parseBrowsePrefillParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const prefillRan = useRef(false);
  const [prefillPlan, setPrefillPlan] = useState<PrefillPlan | null>(null);

  useEffect(() => {
    // isPrefillReady waits out the transient authenticated-but-no-user frame
    // so ownership netting can't be skipped; the ref makes this once-per-mount.
    if (prefillRan.current) return;
    if (!isPrefillReady({ cardCount: prefill.cards.length, sessionStatus, hasUser: !!user })) return;
    prefillRan.current = true;

    (async () => {
      const lookup = await searchClient.lookupByTalisharIds(prefill.cards.map(c => c.talisharId));
      if (!lookup.success) return;

      let owned: Record<string, number> = {};
      if (user) {
        const cardIds = [...new Set(Object.values(lookup.data).map(c => c.cardUniqueId))];
        const ownedRes = await bindersClient.getOwnedCountsByCard(cardIds);
        if (ownedRes.success) owned = ownedRes.data;
      }

      const plan = computePrefillPlan(prefill.cards, lookup.data, owned);
      setPrefillPlan(plan);
      if (plan.lines.length > 0) {
        await handlers.runBulkSearch(toCardListText(plan.lines), { stageAll: true, quiet: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, sessionStatus, user]);

  // ?binder= preselect — override the hook's first-binder default once binders load.
  useEffect(() => {
    if (!prefill.binderSlug) return;
    if (state.binders.some((b: any) => b.slug === prefill.binderSlug)) {
      handlers.setSelectedBinderSlug(prefill.binderSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.binders, prefill.binderSlug]);

  const handlePrintingView = (instanceId: string) => {
    setActiveDialogInstanceId(instanceId);
  };

  const activeInstance = state.bulkResults.find(c => c.instanceId === activeDialogInstanceId);
  const stagedCards = state.bulkResults.filter(c => c.isStaged);

  const totalStagedQuantity = calculateTotalQuantity(stagedCards);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
        {/* Desktop Sidebar - hidden on mobile */}
        <PendingImportSidebar
        allCards={state.bulkResults}
        onUpdateQuantity={handlers.updateCardQuantity}
        onUnstage={handlers.toggleStagedStatus}
        onClear={handlers.clearStaged}
        onPrintingView={handlePrintingView}
        onSetAllForTrade={handlers.setAllStagedForTrade}
        onToggleTrade={handlers.toggleForTrade}
        />

        {/* Mobile FAB - hidden on desktop */}
        <StagedFAB
          count={stagedCards.length}
          onClick={() => setMobileSheetOpen(true)}
        />

        {/* Mobile Sheet - hidden on desktop */}
        <MobileStagedSheet
          open={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
          allCards={state.bulkResults}
          onUpdateQuantity={handlers.updateCardQuantity}
          onUnstage={handlers.toggleStagedStatus}
          onClear={handlers.clearStaged}
          onPrintingView={handlePrintingView}
          binders={state.binders}
          selectedBinderSlug={state.selectedBinderSlug}
          onSelectBinder={handlers.setSelectedBinderSlug}
          onAddToBinder={() => {
            handlers.handleAddToBinder();
            setMobileSheetOpen(false);
          }}
          onAddToWants={() => {
            handlers.handleAddToWants();
            setMobileSheetOpen(false);
          }}
          isImporting={state.isImporting}
          onSetAllForTrade={handlers.setAllStagedForTrade}
          onToggleTrade={handlers.toggleForTrade}
        />

        <div className="lg:ml-96">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add Cards via Bulk Import</h1>
            <p className="text-muted-foreground">
              Quickly find the best printings for your decklist or card list.
            </p>
          </div>

          {/* <SuperSlamDisclosure />
          <br></br> */}

          {prefillPlan && (
            <div className="mb-6 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Link2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {prefillPlan.summary.toAdd > 0
                  ? `${prefillPlan.summary.toAdd} card(s) staged from your link.`
                  : "Nothing to add — your collection already covers this list."}
              </p>
              {user && prefillPlan.summary.owned > 0 && (
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {prefillPlan.summary.owned} of {prefillPlan.summary.requested} requested cop(ies)
                  are already in your binders (any printing) and were skipped
                  {prefillPlan.skipped.length > 0 &&
                    `: ${prefillPlan.skipped.map(s => s.displayName).join(", ")}`}.
                </p>
              )}
              {!user && (
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Sign in to net this list against the cards you already own.
                </p>
              )}
              {prefillPlan.unresolved.length > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {prefillPlan.unresolved.length} token(s) couldn&apos;t be matched:{" "}
                  {prefillPlan.unresolved.join(", ")}
                </p>
              )}
            </div>
          )}

          <BulkImportForm
            bulkInput={state.bulkInput}
            onInputChange={handlers.setBulkInput}
            onSearch={handlers.handleBulkSearch}
            loading={state.loading}
          />

          {state.error && (
              <Alert variant="destructive" className="mb-8">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Search Failed</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
              </Alert>
          )}
          
          <ImportActions
            isImporting={state.isImporting}
            // --- PASS THE CORRECT TOTAL QUANTITY ---
            resultsCount={totalStagedQuantity} 
            binders={state.binders}
            selectedBinderSlug={state.selectedBinderSlug}
            onSelectBinder={handlers.setSelectedBinderSlug}
            onCreateBinder={handlers.handleCreateBinder}
            onAddToBinder={handlers.handleAddToBinder}
            onAddToWants={handlers.handleAddToWants}
          />
          
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
      </div>
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
    </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="bg-white dark:bg-gray-900 min-h-screen" />}>
      <BrowsePageContent />
    </Suspense>
  );
}
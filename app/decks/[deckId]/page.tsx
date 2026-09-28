"use client";

// The deck page: a Canva-style left rail (icon + word) with a flyout panel, so
// the tools that live behind Cmd+K chords and small chips on the classic page
// (now /decks/[id]/deprecated) are visible and labelled. Reuses the classic
// page's building blocks: useDeckEditor for data, DeckEditorListView for the
// deck itself, QuickAddCardDialog for adds, and the `deck-highlight-*` events
// for highlighting. On phones the route renders the classic page's mobile
// experience instead (DeckPageRoute).

import { useEffect, useMemo, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, BarChart3, ClipboardList, Command, FileText, Loader2, MoreHorizontal, Search, Swords, Trophy, Tv } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor, type SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory } from "@/lib/services/contracts/IDeckService";
import { decksClient } from "@/lib/client";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import { useDeckCommandHud } from "@/components/deck/editor/useDeckCommandHud";
import { useBinderWantsActions } from "@/hooks/deck/useBinderWantsActions";
import { useDeckOptions } from "@/hooks/deck/useDeckOptions";
import DeckToolbarMoreMenu from "@/components/deck/editor/DeckToolbarMoreMenu";
import QuickAddCardDialog from "@/components/deck/editor/QuickAddCardDialog";
import ViewPrintingsDialog from "@/components/dialogs/cards/view-printings-dialog";
import { computeDeckSectionCounts } from "@/components/deck/editor/deck-section-counts";
import { resolveDefaultDeckViewMode } from "@/lib/deck/deckViewMode";
import { pitchSplit, playableCount } from "@/lib/deck/deck-lens";
import { cn } from "@/lib/utils";
import FindPanel, { type Active } from "./_components/FindPanel";
import DeckResultsTab from "@/components/deck/DeckResultsTab";
import DeckNotesTab from "@/components/deck/DeckNotesTab";
import DeckBulkImport from "@/components/deck/editor/DeckBulkImport";
import { useIsMobile } from "@/components/ui/use-mobile";
import ClassicDeckPage from "./deprecated/page";
import DeckRightRail from "@/components/deck/editor/DeckRightRail";
import DeckTable from "./_components/DeckTable";
import { applyHighlightEvent, type HighlightEvent, type HighlightFilter } from "@/lib/deck/highlight-filters";
import MatchesStrip from "./_components/MatchesStrip";
import BrewView, { BREW_DETAILS_SLOT } from "./_components/BrewView";
import RatiosSection from "./_components/RatiosSection";
import RatioCompare from "./_components/RatioCompare";
import { sanitizeRatios, type DeckRatio } from "@/lib/deck/ratios";
import type { BrewFacets } from "@/lib/deck/brew";

type PanelId = "find" | "stats";
type View = "table" | "cards" | "brew";
const VIEWS: View[] = ["table", "cards", "brew"];
const VIEW_LABEL: Record<View, string> = { table: "Table", cards: "Cards", brew: "Brew" };

const VIEW_KEY = "deckV2View";

type RailItem =
  | { kind: "panel"; id: PanelId; label: string; icon: ComponentType<{ className?: string }> }
  | { kind: "link"; href: string; label: string; icon: ComponentType<{ className?: string }> }
  /** Replaces the deck views in the main area (classic in-page tabs, e.g. Results). */
  | { kind: "main"; id: MainMode; label: string; icon: ComponentType<{ className?: string }> };

type MainMode = "deck" | "results" | "notes" | "import";

/**
 * /decks/[id]: the rail layout on desktop; on phones the classic deck page's
 * mobile experience (the same component as /decks/[id]/deprecated).
 * Waits for the viewport — useIsMobile reports false until it mounts — so
 * phones never flash the desktop layout.
 */
export default function DeckPageRoute() {
  const isMobile = useIsMobile();
  const [viewportResolved, setViewportResolved] = useState(false);
  useEffect(() => { setViewportResolved(true); }, []);
  if (!viewportResolved) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading deck" /></div>;
  }
  return isMobile ? <ClassicDeckPage /> : <DeckV2Page />;
}

function DeckV2Page() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { state, handlers } = useDeckEditor(deckId);
  const deck = state.deck;

  const canEdit = !!(user && deck && (deck.userId === user.id || (deck.coOwners ?? []).includes(user.id)));
  const [panel, setPanel] = useState<PanelId | null>("find");
  const [active, setActive] = useState<Active>(null);
  const [facets, setFacets] = useState<BrewFacets>({});
  const [kitId, setKitId] = useState("");

  // Saved ratios (decks.metadata.ratios): shown optimistically, reverted if the
  // save is refused. `compareId` = the ratio shown side by side above the deck.
  const [ratios, setRatios] = useState<DeckRatio[]>([]);
  const savedRatiosKey = JSON.stringify(state.deck?.metadata?.ratios ?? []);
  useEffect(() => { setRatios(sanitizeRatios(JSON.parse(savedRatiosKey)) ?? []); }, [savedRatiosKey]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const compareRatio = ratios.find(r => r.id === compareId) ?? null;

  // Rail "Deck": open the Deck panel and start clean — highlight, Brew picks,
  // kit, ratio comparison, owned/unowned view and the Find box all reset
  // (pinned Find words stay; remounting the panel clears its box).
  const [findKey, setFindKey] = useState(0);
  // Main area: the deck views, or a classic in-page tab (Results).
  const [mainMode, setMainMode] = useState<MainMode>("deck");
  const resetToDeck = () => {
    setMainMode("deck");
    setPanel("find");
    setActive(null);
    setFacets({});
    setKitId("");
    setCompareId(null);
    setFindKey(k => k + 1);
    window.dispatchEvent(new CustomEvent("deck-highlight-clear"));
    window.dispatchEvent(new CustomEvent("deck-ownership-filter", { detail: { filter: "all", setExplicit: true } }));
  };
  // Cards (the classic card views, the default) or Table (one spreadsheet,
  // matches lifted to the top); a viewer's own pick is remembered.
  const [view, setView] = useState<View>("cards");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as View | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
    } catch { /* default */ }
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience only */ }
  };
  // The card views only hear highlight events while mounted — replay the active
  // one when they appear (child listeners attach before this parent effect runs).
  useEffect(() => {
    if (view !== "cards") return;
    if (!active) {
      // Cmd+K filters set while the Table showed: hand them to the grid (additive
      // re-dispatch is idempotent for the mirror above).
      for (const f of hudFilters) window.dispatchEvent(new CustomEvent("deck-highlight-filter", { detail: { ...f, additive: true, source: "replay" } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("deck-highlight-clear"));
    window.dispatchEvent(new CustomEvent("deck-highlight-filter", { detail: { ...active, source: "panel" } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay on view switch only
  }, [view]);
  const [addTarget, setAddTarget] = useState<DeckCategory | null>(null);

  // Deck Tools HUD (Cmd/Ctrl+K) — the classic page's chords, overlay and
  // ownership views, shared via useDeckCommandHud. 9 / 8 / 7 inside it open the
  // card search for main deck / inventory / bench.
  // A highlight not from the Deck panel (a Cmd+K chord) takes over: the panel
  // row lets go, so the grid shows the full-screen overlay for it.
  // It's also mirrored here (same rules as the grid, lib/deck/highlight-filters)
  // so the Table view can lift Cmd+K matches too.
  const [hudFilters, setHudFilters] = useState<HighlightFilter[]>([]);
  useEffect(() => {
    const onFilter = (e: Event) => {
      const detail = (e as CustomEvent<HighlightEvent & { source?: string }>).detail;
      if (detail?.source === "panel") return;
      setActive(null);
      setHudFilters(prev => applyHighlightEvent(prev, detail));
    };
    const onClear = () => setHudFilters([]);
    window.addEventListener("deck-highlight-filter", onFilter);
    window.addEventListener("deck-highlight-clear", onClear);
    return () => {
      window.removeEventListener("deck-highlight-filter", onFilter);
      window.removeEventListener("deck-highlight-clear", onClear);
    };
  }, []);

  const { chordMode, setChordMode, hud: commandHud } = useDeckCommandHud({
    deck: state.deck ?? null,
    deckId,
    canEdit,
    openQuickAdd: t => { if (canEdit) setAddTarget(t.category); },
  });

  // Binders + add-to-binder / add-to-wants for the card grid (collector mode) —
  // shared with the classic page.
  const { binders, selectedBinderId, handleBinderChange, handleAddToBinder, handleAddToWants } =
    useBinderWantsActions({ user, refreshDeck: handlers.refreshDeck, refreshWants: handlers.refreshWants });

  // Options menu (the classic page's "More": copy/export, export image, stream
  // overlay, settings, owned printings, language) + its dialogs — shared hook.
  const isOwner = !!(user && deck && deck.userId === user.id);
  const options = useDeckOptions({ deck: deck ?? null, deckId, canEdit, isOwner, refreshDeck: handlers.refreshDeck });

  // A bare "+" (outside a text box, HUD closed) opens the card search for the main deck.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (chordMode || addTarget || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "+" && !typing && canEdit) {
        e.preventDefault();
        setAddTarget("maindeck");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chordMode, addTarget, canEdit]);

  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);

  // Deep links: ?tab=notes (what /decks/[id]/notes redirects to) and
  // ?tab=results open that main view once we know the viewer can edit.
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if ((tab === "notes" || tab === "results") && canEdit) { setPanel(null); setMainMode(tab); }
  }, [searchParams, canEdit]);

  // Same visibility rule as the classic page: a private deck the viewer can't
  // edit falls through to the read-only analyze view.
  useEffect(() => {
    if (authLoading || state.deckLoading || !deck) return;
    if (!canEdit && !deck.isPublic) router.replace(`/decks/${deckId}/analyze`);
  }, [authLoading, state.deckLoading, deck, canEdit, deckId, router]);

  const fail = (title: string, description?: string) => toast({ title, description, variant: "destructive" });

  const addPrinting = async (printing: { printing_id: string }, quantity: number) => {
    if (!addTarget) return;
    const result = await decksClient.addPrintings(deckId, [{ printingId: printing.printing_id, quantity, category: addTarget }]);
    // The bulk route answers 200 with per-row outcomes (see the classic page).
    const rowError = result.success
      ? result.data?.results?.find(r => r.printingId === printing.printing_id && !r.success)?.error
      : result.error;
    if (rowError) { fail("Add failed", rowError); throw new Error(rowError); }
    await handlers.refreshDeck();
  };

  // Replace the deck's saved ratios; optimistic, reverted (with a toast) on failure.
  const saveRatios = async (next: DeckRatio[]) => {
    const previous = ratios;
    setRatios(next);
    if (compareId && !next.some(r => r.id === compareId)) setCompareId(null);
    try {
      const res = await fetch(`/api/decks/${deckId}/ratios`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratios: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Could not save ratios");
    } catch (e) {
      setRatios(previous);
      fail("Couldn't save ratios", e instanceof Error ? e.message : undefined);
    }
  };

  // Classic right rail (hover preview + owned progress) beside the card grid,
  // only in the grid's Tiles / Game modes.
  const [gridMode, setGridMode] = useState<"list" | "tile" | "game">("tile");
  const [hoveredCard, setHoveredCard] = useState<ComponentProps<typeof DeckRightRail>["hoveredCard"]>(null);
  const railCounts = useMemo(() => {
    let owned = 0, total = 0;
    for (const c of [...(deck?.maindeck ?? []), ...(deck?.equipment ?? []), ...(deck?.inventory ?? [])]) {
      const qty = c.quantity ?? 1;
      total += qty;
      owned += Math.min(qty, state.ownershipMap.get(c.printingId)?.owned ?? 0);
    }
    return { owned, total };
  }, [deck, state.ownershipMap]);
  const hoveredOwnership = hoveredCard?.printingId ? state.ownershipMap.get(hoveredCard.printingId) : null;

  // Paste-a-decklist import (shared DeckBulkImport): search the pasted list,
  // stage results, then save the staged cards to the deck.
  const [searchFormOpen, setSearchFormOpen] = useState(true);
  const [importPrintingId, setImportPrintingId] = useState<string | null>(null);
  const importInstance = state.bulkResults.find(c => c.instanceId === importPrintingId);
  const stagedCount = state.bulkResults.filter(c => c.isStaged).reduce((n, c) => n + c.quantity, 0);
  const handleImportSearch = async (e: React.FormEvent) => {
    await handlers.handleBulkSearch(e);
    setSearchFormOpen(false);
  };

  // Copy someone else's deck into your own (signed-out → sign in first), then
  // open the copy.
  const [copying, setCopying] = useState(false);
  const copyDeck = async () => {
    if (!deck) return;
    if (!user) { router.push(`/auth/signin?callbackUrl=/decks/${deckId}`); return; }
    setCopying(true);
    const result = await decksClient.copyDeck(deckId, `Copy of ${deck.name}`);
    setCopying(false);
    if (!result.success) { fail("Error", result.error || "Failed to copy deck."); return; }
    toast({ title: "Deck copied", description: "Copied to your decks." });
    router.push(`/decks/${result.data.publicId}`);
  };

  // Brew adds: a zone + quantity chosen on the tile / details panel.
  const addToZone = async (printingId: string, zone: DeckCategory, quantity: number) => {
    const result = await decksClient.addPrintings(deckId, [{ printingId, quantity, category: zone }]);
    // The bulk route answers 200 with per-row outcomes (copy caps, legality).
    const rowError = result.success
      ? result.data?.results?.find(r => r.printingId === printingId && !r.success)?.error
      : result.error;
    if (rowError) fail("Add failed", rowError);
    await handlers.refreshDeck();
  };

  const setQty = async (printingId: string, category: DeckCategory, currentQty: number, delta: 1 | -1) => {
    const result = delta > 0
      ? await decksClient.addPrintings(deckId, [{ printingId, quantity: 1, category }])
      : await decksClient.removePrinting(deckId, printingId, category, 1);
    const error = !result.success
      ? result.error
      : delta > 0 ? (result.data as any)?.results?.find((r: any) => r.printingId === printingId && !r.success)?.error : null;
    if (error) fail("Update failed", error);
    await handlers.refreshDeck();
  };

  const removeCard = async (printingId: string, category: DeckCategory) => {
    const result = await decksClient.removePrinting(deckId, printingId, category, 999999);
    if (!result.success) fail("Remove failed", result.error);
    await handlers.refreshDeck();
  };

  const moveCard = async (printingId: string, from: DeckCategory, to: DeckCategory, quantity: number) => {
    const removed = await decksClient.removePrinting(deckId, printingId, from, 999999);
    if (!removed.success) { fail("Move failed", removed.error); return; }
    const added = await decksClient.addPrintings(deckId, [{ printingId, quantity, category: to }]);
    if (!added.success) fail("Move failed", added.error);
    await handlers.refreshDeck();
  };

  const moveOne = async (printingId: string, from: DeckCategory, to: DeckCategory, currentQty: number) => {
    const removed = await decksClient.removePrinting(deckId, printingId, from, 1);
    if (!removed.success) { fail("Move failed", removed.error); return; }
    const added = await decksClient.addPrintings(deckId, [{ printingId, quantity: 1, category: to }]);
    if (!added.success) fail("Move failed", added.error);
    await handlers.refreshDeck();
  };

  const swapPrinting = async (newPrinting: { printing_id: string }) => {
    if (!swapTarget) return;
    const result = await decksClient.swapPrinting(deckId, swapTarget.printingId, newPrinting.printing_id, swapTarget.category);
    if (result.success) toast({ title: "Printing swapped" });
    else fail("Swap failed", result.error);
    setSwapTarget(null);
    await handlers.refreshDeck();
  };

  const rail: RailItem[] = [
    { kind: "panel", id: "find", label: "Deck", icon: Search },
    { kind: "panel", id: "stats", label: "Stats", icon: BarChart3 },
    { kind: "link", href: `/decks/${deckId}/matchups`, label: "Matchups", icon: Swords },
    ...(canEdit ? [{ kind: "main" as const, id: "import" as const, label: "Import list", icon: ClipboardList }] : []),
    ...(canEdit ? [{ kind: "main" as const, id: "results" as const, label: "Results", icon: Trophy }] : []),
    ...(canEdit ? [{ kind: "main" as const, id: "notes" as const, label: "Notes", icon: FileText }] : []),
    { kind: "link", href: `/decks/${deckId}/present`, label: "Present", icon: Tv },
  ];

  if (state.deckLoading || authLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading deck" /></div>;
  }
  if (!deck) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
        <p className="mt-3 text-gray-700 dark:text-gray-300">{state.error || "Deck not found."}</p>
      </div>
    );
  }

  const heroName = deck.heroName || deck.hero?.[0]?.printingDetails?.display_name;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-[calc(100vh-4rem)]">
      <div className="flex">
        {/* Rail */}
        <nav aria-label="Deck tools" className="sticky top-16 flex h-[calc(100vh-4rem)] w-20 shrink-0 flex-col items-stretch border-r border-gray-300 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
          {rail.map(item => {
            const Icon = item.icon;
            const selected = (item.kind === "panel" && panel === item.id) || (item.kind === "main" && mainMode === item.id);
            const inner = (
              <>
                <Icon className="h-5 w-5" />
                <span className={cn("text-[11px] leading-tight text-center", selected && "font-semibold")}>{item.label}</span>
              </>
            );
            // Selected = white tab joined to the open panel (left bar + no right border), classic tab-strip style.
            const cls = cn(
              "flex w-full flex-col items-center gap-1 border-b border-l-[3px] border-b-gray-200 px-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-b-gray-800",
              selected
                ? "-mr-px border-l-blue-600 bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
                : "border-l-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
            );
            if (item.kind === "main") {
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  // The deck panels (filters, stats) don't apply to Results — close them.
                  onClick={() => { if (!selected) setPanel(null); setMainMode(selected ? "deck" : item.id); }}
                  className={cls}
                >
                  {inner}
                </button>
              );
            }
            return item.kind === "panel" ? (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                // "Deck" is home base: always open, and a fresh start — every filter resets.
                onClick={() => (item.id === "find" ? resetToDeck() : setPanel(selected ? null : item.id))}
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <Link key={item.href} href={item.href} className={cls}>{inner}</Link>
            );
          })}
          {/* Deck Tools HUD — same as Cmd/Ctrl+K */}
          <button
            type="button"
            onClick={() => setChordMode("select")}
            aria-label="Tools (Cmd+K)"
            className="flex w-full flex-col items-center gap-1 border-b border-l-[3px] border-b-gray-200 border-l-transparent px-1 py-3 text-gray-700 hover:bg-gray-100 dark:border-b-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Command className="h-5 w-5" />
            <span className="text-[11px] leading-tight text-center">Tools <span className="text-gray-500">⌘K</span></span>
          </button>
          <Link href={`/decks/${deckId}/deprecated`} className="mt-auto flex w-full flex-col items-center gap-1 border-t border-gray-200 px-1 py-3 text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[11px] leading-tight">Classic view</span>
          </Link>
          {/* The classic page's "More" menu, at the very bottom (no Analyze on v2). */}
          <DeckToolbarMoreMenu
            isOwner={isOwner}
            side="right"
            align="end"
            onCopyList={options.handleCopyList}
            onExport={options.handleExportList}
            onExportImage={() => options.setExportImageOpen(true)}
            onPresent={() => router.push(`/decks/${deckId}/present`)}
            onStickers={() => router.push(`/decks/${deckId}/stickers`)}
            onSettings={() => options.setSettingsOpen(true)}
            onUpdateOwnedPrintings={canEdit ? options.handleUpgradePrintings : undefined}
            onConvertLanguage={canEdit ? options.handleConvertLanguage : undefined}
            onStreamOverlay={canEdit ? () => options.setStreamOverlayOpen(true) : undefined}
            trigger={
              <button
                type="button"
                aria-label="Options"
                className="flex w-full flex-col items-center gap-1 border-t border-gray-200 px-1 py-3 text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                <span className="text-[11px] leading-tight">Options</span>
              </button>
            }
          />
        </nav>

        {/* Flyout panel */}
        {panel && (
          <aside aria-label="Deck tool panel" className="sticky top-16 h-[calc(100vh-4rem)] w-80 shrink-0 overflow-y-auto border-r border-gray-300 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            {panel === "find" && (
              <FindPanel
                key={findKey}
                deck={deck} deckId={deckId} active={active} setActive={setActive}
                brewing={view === "brew"} facets={facets} setFacets={setFacets}
                onSaveRatio={canEdit ? (a, b) => saveRatios([...ratios, { id: `r-${Date.now().toString(36)}`, a: { kind: "text", value: a }, b: { kind: "text", value: b } }]) : undefined}
              />
            )}
            {panel === "stats" && (
              <StatsPanel deck={deck}>
                <RatiosSection
                  deck={deck}
                  ratios={ratios}
                  canEdit={canEdit}
                  activeId={compareId}
                  onCompare={r => {
                    if (compareId === r.id) { setCompareId(null); return; }
                    if (view === "brew") chooseView("cards"); // Brew has no deck cards to compare
                    setCompareId(r.id);
                  }}
                  onSave={saveRatios}
                />
              </StatsPanel>
            )}
          </aside>
        )}

        {/* Deck */}
        <main className="min-w-0 flex-1 px-6 py-5">
          <header className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deck.name}</h1>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {[heroName, deck.format, deckSizeLabel(deck)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {/* Someone else's deck: read only, but you can take a copy (classic parity). */}
            {!canEdit && (
              <div className="flex shrink-0 items-center gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Read only</span>
                <button
                  type="button"
                  onClick={copyDeck}
                  disabled={copying}
                  className="rounded-sm border border-gray-400 bg-gray-100 px-3 py-1 text-gray-900 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  {copying ? "Copying…" : "Copy deck"}
                </button>
              </div>
            )}
          </header>
          {mainMode === "import" ? (
            <section aria-label="Import list">
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Paste a decklist (one card per line, e.g. <code>3 Sink Below (blue)</code>), check the matches, stage them, then save.
              </p>
              {stagedCount > 0 && (
                <div className="mb-3 flex items-center justify-between border border-gray-300 bg-gray-100 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <span>{stagedCount} {stagedCount === 1 ? "card" : "cards"} staged</span>
                  <button
                    type="button"
                    onClick={() => handlers.handleSaveToDeck()}
                    disabled={state.isSaving}
                    className="rounded-sm bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {state.isSaving ? "Saving…" : `Save ${stagedCount} Card(s) to Deck`}
                  </button>
                </div>
              )}
              <DeckBulkImport
                state={state}
                handlers={handlers}
                onSearch={handleImportSearch}
                searchFormOpen={searchFormOpen}
                setSearchFormOpen={setSearchFormOpen}
                onPrintingView={setImportPrintingId}
              />
            </section>
          ) : mainMode === "results" ? (
            <section aria-label="Results">
              <DeckResultsTab deckId={deckId} deck={deck} />
            </section>
          ) : mainMode === "notes" ? (
            <section aria-label="Notes">
              <DeckNotesTab deckId={deckId} deck={deck} />
            </section>
          ) : (
          <>
          <div role="group" aria-label="Deck view" className="mb-3 inline-flex overflow-hidden rounded-sm border border-gray-300 text-sm dark:border-gray-700">
            {VIEWS.map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => chooseView(v)}
                className={cn(
                  "px-3 py-1 border-l border-gray-300 first:border-l-0 dark:border-gray-700",
                  view === v ? "bg-gray-200 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white" : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
                )}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          {compareRatio && view !== "brew" && (
            <RatioCompare deck={deck} ratio={compareRatio} style={view === "table" ? "list" : "tiles"} onClose={() => setCompareId(null)} />
          )}
          {view === "brew" ? (
            <BrewView
              deck={deck}
              active={active}
              facets={facets}
              kitId={kitId}
              onKitChange={setKitId}
              canEdit={canEdit}
              onAdd={addToZone}
              onRemoveOne={async (printingId, zone) => {
                const result = await decksClient.removePrinting(deckId, printingId, zone, 1);
                if (!result.success) fail("Remove failed", result.error);
                await handlers.refreshDeck();
              }}
            />
          ) : view === "table" ? (
            <DeckTable
              deck={deck}
              active={active}
              hudFilters={hudFilters}
              ownershipMap={state.ownershipMap}
              canEdit={canEdit}
              onChangeQty={(printingId, zone, delta) => setQty(printingId, zone, 0, delta)}
            />
          ) : (
          <>
          {active && (
            <MatchesStrip
              deck={deck}
              active={active}
              onClear={() => { window.dispatchEvent(new CustomEvent("deck-highlight-clear")); setActive(null); }}
            />
          )}
          <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
          <DeckEditorListView
            deck={deck}
            ownershipMap={state.ownershipMap}
            cardOwnershipMap={state.cardOwnershipMap}
            wantsMap={state.wantsMap}
            canEdit={canEdit}
            defaultViewMode={resolveDefaultDeckViewMode(canEdit, false)}
            onSwap={setSwapTarget}
            onRemove={removeCard}
            onMove={moveCard}
            onMoveSingle={moveOne}
            onRemoveTile={(id, category, qty) => setQty(id, category, qty, -1)}
            onAddOneTile={(id, category, qty) => setQty(id, category, qty, 1)}
            onAddCard={category => setAddTarget(category)}
            // Card lightbox: swap 1..N copies to another printing (classic parity).
            onSwapCopies={async (oldPrintingId, newPrintingId, category, copies) => {
              const result = await decksClient.swapPrinting(deckId, oldPrintingId, newPrintingId, category, copies);
              await handlers.refreshDeck();
              if (!result.success) { fail("Could not change printing", result.error); return false; }
              toast({ title: "Printing updated", description: `${copies} ${copies === 1 ? "copy" : "copies"} moved to the selected printing.` });
              return true;
            }}
            // Panel-row highlights stay in place (the panel stays usable); Cmd+K
            // highlights get the classic full-screen focus overlay.
            inPlaceHighlight={!!active}
            onHighlightCleared={() => setActive(null)}
            binders={binders}
            selectedBinderId={selectedBinderId}
            onBinderChange={handleBinderChange}
            onAddToBinder={handleAddToBinder}
            onAddToWants={handleAddToWants}
            onViewModeChange={setGridMode}
            onCardHover={setHoveredCard}
          />
          </div>
          {gridMode !== "list" && (
            <DeckRightRail
              ownedCount={railCounts.owned}
              totalCount={railCounts.total}
              hoveredCard={hoveredCard && hoveredOwnership
                ? { ...hoveredCard, ownedInDeck: Math.min(hoveredOwnership.owned, hoveredOwnership.needed), neededInDeck: hoveredOwnership.needed }
                : hoveredCard}
            />
          )}
          </div>
          </>
          )}
          </>
          )}
        </main>

        {commandHud}
        {options.dialogs}

        {/* Right-hand column for Brew's card details (portalled in). Collapses to
            nothing while empty, so other views keep the full width. */}
        <div
          id={BREW_DETAILS_SLOT}
          className="sticky top-16 h-[calc(100vh-4rem)] w-80 shrink-0 overflow-y-auto border-l border-gray-300 bg-white empty:hidden dark:border-gray-800 dark:bg-gray-900"
        />
      </div>

      <QuickAddCardDialog
        open={!!addTarget}
        onOpenChange={isOpen => !isOpen && setAddTarget(null)}
        onAdd={addPrinting}
        targetCategory={addTarget ?? "maindeck"}
        deckFormat={deck.format}
        currentDeck={deck}
      />
      {/* Printing picker for a staged import row */}
      <ViewPrintingsDialog
        open={!!importPrintingId}
        onOpenChange={isOpen => !isOpen && setImportPrintingId(null)}
        cardName={importInstance?.selectedPrinting?.display_name || ""}
        cardUniqueId={importInstance?.card_unique_id || ""}
        currentPrintingId={importInstance?.selectedPrinting?.printing_id}
        onSelectPrinting={printing => {
          if (importInstance) handlers.updateCardPrinting(importInstance.instanceId, printing);
          setImportPrintingId(null);
        }}
      />
      <ViewPrintingsDialog
        open={!!swapTarget}
        onOpenChange={isOpen => !isOpen && setSwapTarget(null)}
        cardName={swapTarget?.cardName || ""}
        cardUniqueId={swapTarget?.cardUniqueId || ""}
        currentPrintingId={swapTarget?.printingId}
        onSelectPrinting={swapPrinting}
      />
    </div>
  );
}

// Header size: the deck proper, with the inventory called out separately.
function deckSizeLabel(deck: NonNullable<ReturnType<typeof useDeckEditor>["state"]["deck"]>): string {
  const z = computeDeckSectionCounts(deck);
  const main = z.weapon + z.equipment + z.maindeck;
  return z.inventory ? `${main} cards + ${z.inventory} inventory` : `${main} cards`;
}

const PANEL_H2 = "text-base font-semibold text-gray-900 dark:text-gray-100";
const PANEL_H3 = "mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300";

function StatsPanel({ deck, children }: { deck: NonNullable<ReturnType<typeof useDeckEditor>["state"]["deck"]>; children?: ReactNode }) {
  const split = useMemo(() => pitchSplit(deck), [deck]);
  const zones = useMemo(() => computeDeckSectionCounts(deck), [deck]);
  const rows: Array<[string, number | string, string?]> = [
    ["Red (1)", split.red, "bg-red-500"],
    ["Yellow (2)", split.yellow, "bg-yellow-400"],
    ["Blue (3)", split.blue, "bg-blue-500"],
    ...(split.none ? [["No pitch", split.none] as [string, number]] : []),
  ];
  const total = playableCount(deck);
  return (
    <div className="space-y-5 text-sm text-gray-800 dark:text-gray-200">
      <div>
        <h2 className={PANEL_H2}>Stats</h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Main deck, equipment and inventory ({total} cards).</p>
      </div>
      <section className="space-y-2">
        <h3 className={PANEL_H3}>Pitch</h3>
        {rows.map(([label, n, color]) => (
          <div key={label} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <span className={cn("h-2.5 w-2.5 rounded-full", color ?? "bg-gray-400")} aria-hidden />
            <span className="flex-1">{label}</span>
            <span className="tabular-nums">{n}</span>
          </div>
        ))}
        {split.averageCost != null && (
          <p className="text-sm text-gray-700 dark:text-gray-300">Average cost <strong className="tabular-nums">{split.averageCost.toFixed(1)}</strong></p>
        )}
      </section>
      <section className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
        <h3 className={PANEL_H3}>Zones</h3>
        {([["Weapons", zones.weapon], ["Equipment", zones.equipment], ["Main deck", zones.maindeck], ["Inventory", zones.inventory], ["Bench", zones.bench]] as const).map(([label, n]) => (
          <div key={label} className="flex justify-between"><span>{label}</span><span className="tabular-nums">{n}</span></div>
        ))}
      </section>
      {children}
    </div>
  );
}

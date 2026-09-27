"use client";

// Deck page v2 — EXPERIMENT. A Canva-style left rail (icon + word) with a
// flyout panel, so the tools that live behind Cmd+K chords and small chips on
// the classic page (/decks/[id]) are visible and labelled. Reuses the classic
// page's building blocks: useDeckEditor for data, DeckEditorListView for the
// deck itself, QuickAddCardDialog for adds, and the `deck-highlight-*` events
// for highlighting. Desktop only for now; phones get a link to the classic page.

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, BarChart3, FileText, Loader2, Search, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeckEditor, type SwapTarget } from "@/hooks/deck/useDeckEditor";
import type { DeckCategory } from "@/lib/services/contracts/IDeckService";
import { decksClient } from "@/lib/client";
import DeckEditorListView from "@/components/deck/editor/DeckEditorListView";
import QuickAddCardDialog from "@/components/deck/editor/QuickAddCardDialog";
import ViewPrintingsDialog from "@/components/dialogs/cards/view-printings-dialog";
import { computeDeckSectionCounts } from "@/components/deck/editor/deck-section-counts";
import { resolveDefaultDeckViewMode } from "@/lib/deck/deckViewMode";
import { pitchSplit, playableCount } from "@/lib/deck/deck-lens";
import { cn } from "@/lib/utils";
import FindPanel, { type Active } from "./FindPanel";
import DeckTable from "./DeckTable";
import MatchesStrip from "./MatchesStrip";
import BrewView from "./BrewView";
import type { BrewFacets } from "@/lib/deck/brew";

type PanelId = "find" | "stats";
type View = "table" | "cards" | "brew";
const VIEWS: View[] = ["table", "cards", "brew"];
const VIEW_LABEL: Record<View, string> = { table: "Table", cards: "Cards", brew: "Brew" };

const VIEW_KEY = "deckV2View";

type RailItem =
  | { kind: "panel"; id: PanelId; label: string; icon: ComponentType<{ className?: string }> }
  | { kind: "link"; href: string; label: string; icon: ComponentType<{ className?: string }> };

export default function DeckV2Page() {
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
  // Table (one spreadsheet, matches lifted to the top) or the classic card views.
  const [view, setView] = useState<View>("table");
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
    if (view !== "cards" || !active) return;
    window.dispatchEvent(new CustomEvent("deck-highlight-clear"));
    window.dispatchEvent(new CustomEvent("deck-highlight-filter", { detail: active }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay on view switch only
  }, [view]);
  const [addTarget, setAddTarget] = useState<DeckCategory | null>(null);

  // Keyboard: Cmd/Ctrl+K opens Find in deck with its box focused; a 9 / 8 / 7
  // pressed right after opens the card search for main deck / inventory / bench
  // (the classic page's chord). A bare "+" (outside a text box) opens the card
  // search for the main deck.
  const chordAtRef = useRef(0);
  useEffect(() => {
    const CHORD_MS = 1500;
    const ZONE_KEYS: Record<string, DeckCategory> = { "9": "maindeck", "8": "inventory", "7": "benched" };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPanel("find");
        chordAtRef.current = Date.now();
        requestAnimationFrame(() => document.getElementById("find-text-input")?.focus());
        return;
      }
      const armed = Date.now() - chordAtRef.current < CHORD_MS;
      chordAtRef.current = 0;
      if (addTarget || e.metaKey || e.ctrlKey || e.altKey) return;
      if (armed && ZONE_KEYS[e.key]) {
        e.preventDefault(); // don't type the digit into the focused find box
        if (canEdit) setAddTarget(ZONE_KEYS[e.key]);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "+" && !typing && canEdit) {
        e.preventDefault();
        setAddTarget("maindeck");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addTarget, canEdit]);
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);

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
    { kind: "panel", id: "find", label: "Find in deck", icon: Search },
    { kind: "panel", id: "stats", label: "Stats", icon: BarChart3 },
    { kind: "link", href: `/decks/${deckId}/matchups`, label: "Matchups", icon: Swords },
    ...(canEdit ? [{ kind: "link" as const, href: `/decks/${deckId}/notes`, label: "Notes", icon: FileText }] : []),
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
    <div className="bg-gray-50 dark:bg-gray-950 min-h-[calc(100vh-4rem)]">
      {/* Phones: the rail layout needs width; send people to the classic page. */}
      <div className="md:hidden px-4 py-10 text-center text-sm text-gray-700 dark:text-gray-300">
        This layout is a desktop experiment.{" "}
        <Link href={`/decks/${deckId}`} className="text-blue-700 underline dark:text-blue-400">Open the regular deck page</Link>.
      </div>

      <div className="hidden md:flex">
        {/* Rail */}
        <nav aria-label="Deck tools" className="sticky top-16 flex h-[calc(100vh-4rem)] w-20 shrink-0 flex-col items-stretch border-r border-gray-300 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          {rail.map(item => {
            const Icon = item.icon;
            const selected = item.kind === "panel" && panel === item.id;
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
                ? "-mr-px border-l-blue-600 bg-white text-gray-900 dark:bg-gray-950 dark:text-white"
                : "border-l-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
            );
            return item.kind === "panel" ? (
              <button key={item.id} type="button" aria-pressed={selected} onClick={() => setPanel(selected ? null : item.id)} className={cls}>{inner}</button>
            ) : (
              <Link key={item.href} href={item.href} className={cls}>{inner}</Link>
            );
          })}
          <Link href={`/decks/${deckId}`} className="mt-auto flex w-full flex-col items-center gap-1 border-t border-gray-200 px-1 py-3 text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[11px] leading-tight">Classic view</span>
          </Link>
        </nav>

        {/* Flyout panel */}
        {panel && (
          <aside aria-label="Deck tool panel" className="sticky top-16 h-[calc(100vh-4rem)] w-80 shrink-0 overflow-y-auto border-r border-gray-300 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950">
            {panel === "find" && <FindPanel deck={deck} deckId={deckId} active={active} setActive={setActive} brewing={view === "brew"} facets={facets} setFacets={setFacets} />}
            {panel === "stats" && <StatsPanel deck={deck} deckId={deckId} />}
          </aside>
        )}

        {/* Deck */}
        <main className="min-w-0 flex-1 px-6 py-5">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deck.name}</h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              {[heroName, deck.format, deckSizeLabel(deck)].filter(Boolean).join(" · ")}
            </p>
          </header>
          <div role="group" aria-label="Deck view" className="mb-3 inline-flex overflow-hidden rounded-sm border border-gray-300 text-sm dark:border-gray-700">
            {VIEWS.map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => chooseView(v)}
                className={cn(
                  "px-3 py-1 border-l border-gray-300 first:border-l-0 dark:border-gray-700",
                  view === v ? "bg-gray-200 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white" : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900",
                )}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          {view === "brew" ? (
            <BrewView deck={deck} active={active} facets={facets} />
          ) : view === "table" ? (
            <DeckTable
              deck={deck}
              active={active}
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
            inPlaceHighlight
            onHighlightCleared={() => setActive(null)}
          />
          </>
          )}
        </main>
      </div>

      <QuickAddCardDialog
        open={!!addTarget}
        onOpenChange={isOpen => !isOpen && setAddTarget(null)}
        onAdd={addPrinting}
        targetCategory={addTarget ?? "maindeck"}
        deckFormat={deck.format}
        currentDeck={deck}
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

function StatsPanel({ deck, deckId }: { deck: NonNullable<ReturnType<typeof useDeckEditor>["state"]["deck"]>; deckId: string }) {
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
    </div>
  );
}

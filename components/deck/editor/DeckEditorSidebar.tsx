"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Plus, Minus, Save, AlertTriangle, Loader2, ChevronDown, ChevronRight, Archive, ArchiveRestore, Sofa } from "lucide-react";
import { getFoilingName, getSetName, getVariantBadgeStyles } from "@/lib/fab-formatters";
import { cn } from "@/lib/utils";
import type { DeckDTO, DeckPrintingDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";
import type { OwnershipEntry, SwapTarget } from "@/hooks/deck/useDeckEditor";
import PrintingSelectorDialog from "./PrintingSelectorDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardGroup {
  key: string;
  displayName: string;
  pitch: number | null;
  totalQty: number;
  printings: DeckPrintingDTO[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const PITCH_DOT_CLASS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

function groupAndSortCards(cards: DeckPrintingDTO[]): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const card of cards) {
    const uid = card.printingDetails?.card_unique_id || card.printingId;
    if (!map.has(uid)) {
      map.set(uid, {
        key: uid,
        displayName:
          card.printingDetails?.display_name ||
          card.printingDetails?.name ||
          card.printingId,
        pitch: (card.printingDetails?.pitch as number | undefined) || null,
        totalQty: 0,
        printings: [],
      });
    }
    const g = map.get(uid)!;
    g.totalQty += card.quantity ?? 1;
    g.printings.push(card);
  }
  return Array.from(map.values()).sort((a, b) => {
    const pA = a.pitch ?? 4;
    const pB = b.pitch ?? 4;
    if (pA !== pB) return pA - pB;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** "EVO013 RF", "ARC001 1st CF", "HVY007 EA", "ELE001 Marvel" */
function getPrintingLabel(p: any): string {
  if (!p) return "?";
  const num = p.collector_number || p.set?.toUpperCase() || "?";
  const parts: string[] = [num];
  if (p.edition === "f") parts.push("1st");
  else if (p.edition === "u") parts.push("U");
  if (p.rarity === "v") return [...parts, "Marvel"].join(" ");
  if (p.is_extended_art) parts.push("EA");
  if (p.foiling === "c") parts.push("CF");
  else if (p.foiling === "r") parts.push("RF");
  else if (p.foiling === "g") parts.push("GF");
  return parts.join(" ");
}

/** Returns the max copies of this card allowed in a deck based on its type/subtypes/keywords. */
function getDeckLimit(printingDetails: any): number {
  if (!printingDetails) return 3;
  const types = (printingDetails.types || []).map((t: string) => String(t).toLowerCase());
  if (types.some((t: string) => t === "hero")) return 1;
  const fields = [
    ...(printingDetails.subtypes || []),
    ...(printingDetails.keywords || []),
  ].map((s: string) => String(s).toLowerCase());
  if (fields.some(s => s === "legendary")) return 1;
  if (fields.some(s => s.includes("unlimited"))) return Infinity;
  return 3;
}

// ─── Hover image preview (centered, pointer-events-none) ──────────────────────

function HoverImagePreview({ imageUrl, cardName }: { imageUrl: string; cardName: string }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
      <img
        src={imageUrl}
        alt={cardName}
        className="w-[240px] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}

// ─── Grouped card row ─────────────────────────────────────────────────────────

function GroupedCardRow({
  group,
  category,
  ownershipMap,
  onSwapCard,
  onRemoveCard,
  onRemoveGroup,
  onSelectCard,
  onUpdateDeckCardQty,
  onMovePrinting,
  onHoverImage,
  onClearImage,
}: {
  group: CardGroup;
  category: DeckCategory;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwapCard?: (target: SwapTarget) => void;
  onRemoveCard?: (printingId: string, category: DeckCategory) => void;
  onRemoveGroup?: (printingIds: string[], category: DeckCategory) => void;
  onSelectCard?: (cardUniqueId: string, cardName: string, category: DeckCategory, currentPrintings: DeckPrintingDTO[]) => void;
  onUpdateDeckCardQty?: (printingId: string, newQty: number, category: DeckCategory) => void;
  onMovePrinting?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, currentQty: number) => void;
  onHoverImage: (url: string, name: string) => void;
  onClearImage: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstPrinting = group.printings[0];
  const p = firstPrinting?.printingDetails;
  const groupImageUrl = p?.image_url as string | undefined;

  const limit = getDeckLimit(p);
  const isAtLimit = group.totalQty >= limit;

  const totalOwned = group.printings.reduce(
    (s, pr) => s + (ownershipMap.get(pr.printingId)?.owned ?? 0),
    0
  );
  const hasOwnershipData = group.printings.some(pr => ownershipMap.has(pr.printingId));
  const isFullyOwned = hasOwnershipData && totalOwned >= group.totalQty;

  const pitchClass = group.pitch
    ? PITCH_DOT_CLASS[group.pitch]
    : "bg-gray-300 dark:bg-gray-600";

  return (
    <div>
      {/* Group header row */}
      <div
        className="flex items-center gap-1.5 py-1 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded group text-sm cursor-default"
        onMouseEnter={() => groupImageUrl && onHoverImage(groupImageUrl, group.displayName)}
        onMouseLeave={onClearImage}
      >
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", pitchClass)} />
        <span
          className={cn(
            "flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200",
            onSelectCard && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
          )}
          title={group.displayName}
          onClick={onSelectCard ? () => onSelectCard(group.key, group.displayName, category, group.printings) : undefined}
        >
          {group.displayName}
        </span>
        <span className={cn("tabular-nums text-xs", isAtLimit ? "text-amber-500" : "text-gray-400")}>
          {group.totalQty}{limit < Infinity ? `/${limit}` : ""}×
        </span>
        {hasOwnershipData ? (
          isFullyOwned ? (
            <span className="text-green-500 text-xs w-4 text-center">✓</span>
          ) : (
            <span className="text-amber-500 text-xs w-4 text-center">○</span>
          )
        ) : (
          <span className="w-4" />
        )}
        {onRemoveGroup && (
          <button
            onClick={e => { e.stopPropagation(); onRemoveGroup(group.printings.map(p => p.printingId), category); }}
            className="flex-shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove card from deck"
            onMouseEnter={e => e.stopPropagation()}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          onMouseEnter={e => e.stopPropagation()}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded printing rows */}
      {expanded && (
        <div className="pl-6 mb-0.5">
          {group.printings.map(pr => {
            const own = ownershipMap.get(pr.printingId);
            const prImageUrl = pr.printingDetails?.image_url as string | undefined;
            return (
              <div
                key={pr.printingId}
                className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded group/pr text-xs cursor-default"
                onMouseEnter={() => prImageUrl && onHoverImage(prImageUrl, group.displayName)}
                onMouseLeave={onClearImage}
              >
                <span
                  className={cn(
                    "flex-1 text-gray-500 dark:text-gray-400 truncate font-mono",
                    onSwapCard && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  )}
                  onClick={
                    onSwapCard
                      ? () =>
                          onSwapCard({
                            printingId: pr.printingId,
                            cardUniqueId: pr.printingDetails?.card_unique_id || "",
                            cardName: group.displayName,
                            category,
                          })
                      : undefined
                  }
                >
                  {getPrintingLabel(pr.printingDetails)}
                </span>
                {/* Qty stepper */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => onUpdateDeckCardQty?.(pr.printingId, (pr.quantity ?? 1) - 1, category)}
                    disabled={!onUpdateDeckCardQty || (pr.quantity ?? 1) <= 0}
                    title="Remove one"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </Button>
                  <span className="w-5 text-center tabular-nums text-gray-700 dark:text-gray-300">
                    {pr.quantity ?? 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => onUpdateDeckCardQty?.(pr.printingId, (pr.quantity ?? 1) + 1, category)}
                    disabled={!onUpdateDeckCardQty || isAtLimit}
                    title={isAtLimit ? `Limit: ${limit === 1 ? "Legendary (1 copy)" : `${limit} copies`}` : "Add one"}
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </Button>
                </div>
                {own ? (
                  own.owned >= own.needed ? (
                    <span className="text-green-500 w-4 text-center">✓</span>
                  ) : (
                    <span className="text-amber-500 w-4 text-center">○</span>
                  )
                ) : (
                  <span className="w-4" />
                )}
                {onMovePrinting && (() => {
                  const qty = pr.quantity ?? 1;
                  const buttons: Array<{ toCategory: DeckCategory; title: string; Icon: React.ComponentType<{ className?: string }> }> = [];
                  if (category === "maindeck") {
                    buttons.push({ toCategory: "inventory", title: "Move 1 to Inventory", Icon: Archive });
                    buttons.push({ toCategory: "benched", title: "Move 1 to Bench", Icon: Sofa });
                  } else if (category === "equipment") {
                    buttons.push({ toCategory: "inventory", title: "Move 1 to Inventory", Icon: Archive });
                  } else if (category === "inventory") {
                    buttons.push({ toCategory: "maindeck", title: "Move 1 to Library", Icon: ArchiveRestore });
                    buttons.push({ toCategory: "benched", title: "Move 1 to Bench", Icon: Sofa });
                  } else if (category === "benched") {
                    buttons.push({ toCategory: "maindeck", title: "Move 1 to Library", Icon: ArchiveRestore });
                    buttons.push({ toCategory: "inventory", title: "Move 1 to Inventory", Icon: Archive });
                  }
                  return buttons.map(({ toCategory, title, Icon }) => (
                    <Button
                      key={toCategory}
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 text-gray-300 hover:text-indigo-500 opacity-0 group-hover/pr:opacity-100 transition-opacity flex-shrink-0"
                      onClick={() => onMovePrinting(pr.printingId, category, toCategory, qty)}
                      title={title}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </Button>
                  ));
                })()}
                {onRemoveCard && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 text-gray-300 hover:text-red-500 opacity-0 group-hover/pr:opacity-100 transition-opacity flex-shrink-0"
                    onClick={() => onRemoveCard(pr.printingId, category)}
                    title="Remove all"
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Section accordion ────────────────────────────────────────────────────────

interface SectionAccordionProps {
  label: string;
  count: number;
  limit?: string;
  warn?: boolean;
  defaultOpen?: boolean;
  cards: DeckPrintingDTO[];
  category: DeckCategory;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwapCard?: (target: SwapTarget) => void;
  onRemoveCard?: (printingId: string, category: DeckCategory) => void;
  onRemoveGroup?: (printingIds: string[], category: DeckCategory) => void;
  onSelectCard?: (cardUniqueId: string, cardName: string, category: DeckCategory, currentPrintings: DeckPrintingDTO[]) => void;
  onUpdateDeckCardQty?: (printingId: string, newQty: number, category: DeckCategory) => void;
  onMovePrinting?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, currentQty: number) => void;
  onHoverImage: (url: string, name: string) => void;
  onClearImage: () => void;
}

function SectionAccordion({
  label,
  count,
  limit,
  warn,
  defaultOpen = false,
  cards,
  category,
  ownershipMap,
  onSwapCard,
  onRemoveCard,
  onRemoveGroup,
  onSelectCard,
  onUpdateDeckCardQty,
  onMovePrinting,
  onHoverImage,
  onClearImage,
}: SectionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const groups = groupAndSortCards(cards);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex justify-between items-center text-sm py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded px-1 -mx-1">
        <div className="flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
        </div>
        <span
          className={cn(
            "font-semibold tabular-nums",
            warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
          )}
        >
          {count}
          {limit && <span className="text-gray-400 font-normal"> / {limit}</span>}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {groups.length === 0 ? (
          <p className="text-xs text-gray-400 py-1 px-2 italic">Empty</p>
        ) : (
          <div className="mt-0.5 mb-1 pl-2">
            {groups.map(group => (
              <GroupedCardRow
                key={group.key}
                group={group}
                category={category}
                ownershipMap={ownershipMap}
                onSwapCard={onSwapCard}
                onRemoveCard={onRemoveCard}
                onRemoveGroup={onRemoveGroup}
                onSelectCard={onSelectCard}
                onUpdateDeckCardQty={onUpdateDeckCardQty}
                onMovePrinting={onMovePrinting}
                onHoverImage={onHoverImage}
                onClearImage={onClearImage}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

interface DeckEditorSidebarProps {
  deck: DeckDTO | null;
  deckLoading: boolean;
  stagedCards: any[];
  deckCounts: { hero: number; equipment: number; maindeck: number; inventory: number; benched: number };
  isSaving: boolean;
  ownershipMap: Map<string, OwnershipEntry>;
  deckId: string;
  onUpdateQuantity: (instanceId: string, newQuantity: number) => void;
  onUnstage: (instanceId: string) => void;
  onClear: () => void;
  onSave: () => void;
  onPrintingView: (instanceId: string) => void;
  onSwapDeckCard?: (target: SwapTarget) => void;
  onRemoveDeckCard?: (printingId: string, category: DeckCategory) => void;
  onRemoveGroupFromDeck?: (printingIds: string[], category: DeckCategory) => void;
  onUpdateDeckCardQty?: (printingId: string, newQty: number, category: DeckCategory) => void;
  onMovePrinting?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, currentQty: number) => void;
  onRefreshDeck: () => Promise<void>;
}

const SECTION_LABEL: Record<string, string> = {
  hero: "Hero",
  equipment: "Equipment",
  maindeck: "Main Deck",
  inventory: "Inventory",
  benched: "Bench",
};

interface SelectedCard {
  cardUniqueId: string;
  cardName: string;
  category: DeckCategory;
  currentPrintings: DeckPrintingDTO[];
}

export default function DeckEditorSidebar({
  deck,
  deckLoading,
  stagedCards,
  deckCounts,
  isSaving,
  ownershipMap,
  deckId,
  onUpdateQuantity,
  onUnstage,
  onClear,
  onSave,
  onPrintingView,
  onSwapDeckCard,
  onRemoveDeckCard,
  onRemoveGroupFromDeck,
  onUpdateDeckCardQty,
  onMovePrinting,
  onRefreshDeck,
}: DeckEditorSidebarProps) {
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string } | null>(null);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);

  const handleSelectCard = (cardUniqueId: string, cardName: string, category: DeckCategory, currentPrintings: DeckPrintingDTO[]) => {
    setSelectedCard({ cardUniqueId, cardName, category, currentPrintings });
  };

  const pendingCounts = stagedCards.reduce(
    (acc, card) => {
      const cat = card.deckCategory || "maindeck";
      acc[cat] = (acc[cat] || 0) + card.quantity;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalMaindeck = deckCounts.maindeck + (pendingCounts.maindeck || 0);
  const totalEquipment = deckCounts.equipment + (pendingCounts.equipment || 0);
  const maindeckShort = totalMaindeck < 60;
  const equipmentFull = totalEquipment > 5;

  const validationWarnings: string[] = [];
  if (maindeckShort) validationWarnings.push(`Main deck needs ${60 - totalMaindeck} more card(s)`);
  if (equipmentFull) validationWarnings.push(`Equipment exceeds 5 slots (${totalEquipment})`);

  const sharedHoverProps = {
    onHoverImage: (url: string, name: string) => setHoveredImage({ url, name }),
    onClearImage: () => setHoveredImage(null),
    onSelectCard: handleSelectCard,
    onUpdateDeckCardQty,
    onRemoveGroup: onRemoveGroupFromDeck,
    onMovePrinting,
  };

  return (
    <>
      <div className="hidden lg:flex fixed left-0 top-16 w-96 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col z-20">
        {/* Deck header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {deckLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading deck...</span>
            </div>
          ) : deck ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{deck.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {deck.heroName && (
                  <Badge variant="outline" className="text-xs">{deck.heroName}</Badge>
                )}
                {deck.format && (
                  <Badge variant="secondary" className="text-xs">{deck.format}</Badge>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Deck not found</p>
          )}
        </div>

        {/* Deck contents */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[45%]">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
            Deck Contents
          </p>
          <div className="space-y-0.5">
            <SectionAccordion
              label="Hero"
              count={deckCounts.hero + (pendingCounts.hero || 0)}
              limit="1"
              cards={deck?.hero || []}
              category="hero"
              ownershipMap={ownershipMap}
              onSwapCard={onSwapDeckCard}
              onRemoveCard={onRemoveDeckCard}
              {...sharedHoverProps}
            />
            <SectionAccordion
              label="Equipment"
              count={totalEquipment}
              limit="5"
              warn={equipmentFull}
              cards={deck?.equipment || []}
              category="equipment"
              ownershipMap={ownershipMap}
              onSwapCard={onSwapDeckCard}
              onRemoveCard={onRemoveDeckCard}
              {...sharedHoverProps}
            />
            <SectionAccordion
              label="Main Deck"
              count={totalMaindeck}
              limit="60+"
              warn={maindeckShort && totalMaindeck > 0}
              defaultOpen={true}
              cards={deck?.maindeck || []}
              category="maindeck"
              ownershipMap={ownershipMap}
              onSwapCard={onSwapDeckCard}
              onRemoveCard={onRemoveDeckCard}
              {...sharedHoverProps}
            />
            <SectionAccordion
              label="Inventory"
              count={deckCounts.inventory + (pendingCounts.inventory || 0)}
              cards={deck?.inventory || []}
              category="inventory"
              ownershipMap={ownershipMap}
              onSwapCard={onSwapDeckCard}
              onRemoveCard={onRemoveDeckCard}
              {...sharedHoverProps}
            />
            <SectionAccordion
              label="Bench"
              count={deckCounts.benched + (pendingCounts.benched || 0)}
              cards={deck?.benched || []}
              category="benched"
              ownershipMap={ownershipMap}
              onSwapCard={onSwapDeckCard}
              onRemoveCard={onRemoveDeckCard}
              {...sharedHoverProps}
            />
          </div>

          {validationWarnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {validationWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staged cards */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Pending ({stagedCards.length})
            </p>
            {stagedCards.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {stagedCards.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
                Click "To Stage" on a card to add it to the deck.
              </p>
            ) : (
              stagedCards.map(instance => {
                const p = instance.selectedPrinting;
                const sectionLabel = SECTION_LABEL[instance.deckCategory] || "Main Deck";
                return (
                  <div
                    key={instance.instanceId}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <img
                      src={p?.image_url || "/cardback.webp"}
                      alt={p?.display_name}
                      className="w-14 h-[79px] object-cover rounded border border-gray-300 dark:border-gray-600 flex-shrink-0 cursor-pointer"
                      onClick={() => onPrintingView(instance.instanceId)}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                        onClick={() => onPrintingView(instance.instanceId)}
                        title={p?.display_name}
                      >
                        {p?.display_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{getSetName(p?.set)}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">{sectionLabel}</span>
                        {p?.foiling && (
                          <span
                            className={cn(
                              "text-xs font-medium px-1.5 py-0.5 rounded-full",
                              getVariantBadgeStyles(p.rarity, p.foiling)
                            )}
                          >
                            {getFoilingName(p.foiling, p.is_extended_art)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between self-stretch">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={() => onUnstage(instance.instanceId)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => onUpdateQuantity(instance.instanceId, Math.max(1, instance.quantity - 1))}
                          disabled={instance.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-bold text-center w-6 text-sm text-gray-900 dark:text-gray-100">
                          {instance.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => onUpdateQuantity(instance.instanceId, instance.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            className="w-full"
            onClick={onSave}
            disabled={stagedCards.length === 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save {stagedCards.length > 0 ? `${stagedCards.reduce((s, c) => s + c.quantity, 0)} Card(s)` : ""} to Deck
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Centered hover image preview — pointer-events-none so it never blocks interaction */}
      {hoveredImage && (
        <HoverImagePreview imageUrl={hoveredImage.url} cardName={hoveredImage.name} />
      )}

      {/* Printing selector dialog — opened by clicking a card name in the deck sections */}
      {selectedCard && (
        <PrintingSelectorDialog
          open={!!selectedCard}
          onOpenChange={open => { if (!open) setSelectedCard(null); }}
          cardName={selectedCard.cardName}
          cardUniqueId={selectedCard.cardUniqueId}
          category={selectedCard.category}
          deckId={deckId}
          currentPrintings={selectedCard.currentPrintings}
          onApply={onRefreshDeck}
        />
      )}
    </>
  );
}

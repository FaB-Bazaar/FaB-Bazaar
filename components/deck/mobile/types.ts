// components/deck/mobile/types.ts - Shared types for mobile deck components

export interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
  tags?: string[];
}

export interface CardGroup {
  cardName: string;
  cardId: string;
  category: DeckCategory;
  printings: (DeckPrinting & { category: string })[];
}

export type DeckCategory = "hero" | "equipment" | "maindeck" | "inventory";

export interface Deck {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  format: string;
  isPublic: boolean;
  hero: DeckPrinting[];
  equipment: DeckPrinting[];
  maindeck: DeckPrinting[];
  inventory: DeckPrinting[];
  maybeboard?: DeckPrinting[];
  tokens?: DeckPrinting[];
  totalCards: number;
  heroCount: number;
  equipmentCount: number;
  maindeckCount: number;
  inventoryCount: number;
  maybeboardCount?: number;
  tokensCount?: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  heroName?: string;
}

export interface MobileDeckLayoutProps {
  deck: Deck;
  printings: (DeckPrinting & { category: string })[];
  groupedCards: Record<string, CardGroup>;
  filteredPrintings: (DeckPrinting & { category: string })[];
  filteredGroupedCards: Record<string, CardGroup>;
  canEdit: boolean;
  activeCategory: DeckCategory;
  setActiveCategory: (category: DeckCategory) => void;
  ownershipStatus: Map<string, any>;
  wantsMap: Map<string, number>;
  binderMap: Map<string, { quantity: number; cardId: string }>;
  deckCardCounts: Map<string, number>;
  removingCards: Set<string>;
  movingCards: Set<string>;
  binders: any[];
  selectedBinderId: string;
  setSelectedBinderId: (id: string) => void;

  // Handlers
  onRemove: (printing: DeckPrinting & { category: string }) => void;
  onAddAnother: (printing: DeckPrinting & { category: string }) => void;
  onMove: (printing: DeckPrinting & { category: string }) => void;
  onMoveMultiple?: (printing: DeckPrinting & { category: string }, quantity: number) => void;
  onOpenPrintingSwap: (printing: DeckPrinting & { category: string }) => void;
  onOpenOwnershipComparison: (printing: DeckPrinting & { category: string }) => void;
  onAddCard: (category: DeckCategory) => void;
  onAddToWants: (card: DeckPrinting & { category: string }) => void;
  onAddToBinder: (card: DeckPrinting & { category: string }) => void;

  // Search add card handler (same as handleAddPrintingToDeck)
  onSelectCard: (card: any, printing: any, quantity: number) => void;

  // Dialog openers
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenBulkImport: () => void;
}

export const CATEGORY_LABELS: Record<DeckCategory, string> = {
  hero: "Hero",
  equipment: "Equipment",
  maindeck: "Main Deck",
  inventory: "Inventory",
};

export const PITCH_LABELS: Record<string, string> = {
  "pitch-1-red": "Red",
  "pitch-2-yellow": "Yellow",
  "pitch-3-blue": "Blue",
  "no-pitch": "No Pitch",
};

export const PITCH_COLORS: Record<string, string> = {
  "pitch-1-red": "bg-red-500",
  "pitch-2-yellow": "bg-yellow-500",
  "pitch-3-blue": "bg-blue-500",
  "no-pitch": "bg-gray-400",
};

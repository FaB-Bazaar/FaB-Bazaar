import type { CuratedListDTO, CuratedListCardDTO } from '@/lib/services/contracts/ICuratedListService';
import { RARITY_MAP, type RarityCode } from '@/lib/fab-constants/rarities';

const RARITY_ORDER: Array<RarityCode | string> = [
  'Fabled',
  'Legendary',
  'Marvel',
  'Majestic',
  'Super Rare',
  'Rare',
  'Common',
  'Promo',
  'Token',
  'Basic',
];

export interface PoolCardSource {
  listId: string;
  listName: string;
  heroName: string | null;
  count: number;
}

export interface PoolCard {
  cardUniqueId: string;
  displayName: string;
  rarity: string;
  rarityCode: string;
  types: string[];
  keywords: string[];
  facetTags: string[];
  imageUrl?: string;
  setCode?: string;
  collectorNumber?: string;
  color?: string;
  foiling?: string;
  edition?: string;
  typeTextDisplay?: string;
  tcgLow?: number;
  tcgMarket?: number;
  tcgMid?: number;
  tcgHigh?: number;
  tcgplayerUrl?: string;
  isExtendedArt?: boolean;
  artVariations?: string[];
  foilInsetTop?: number;
  foilInsetRight?: number;
  foilInsetBottom?: number;
  foilInsetLeft?: number;
  foilInsetRound?: string;
  printingId: string;
  comment: string | null;
  rawCount: number;
  cappedCount: number;
  cap: number;
  sources: PoolCardSource[];
}

export type PoolSortMode = 'alpha' | 'set';

export function formatSetCollector(setCode: string | undefined, collectorNumber: string | undefined): string {
  const set = (setCode ?? '').toUpperCase();
  const num = (collectorNumber ?? '').toUpperCase();
  if (!num) return set;
  if (set && num.startsWith(set)) return num;
  return `${set}${num}`;
}

export function sortPoolCards(cards: PoolCard[], mode: PoolSortMode): PoolCard[] {
  const sorted = [...cards];
  if (mode === 'alpha') {
    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return sorted;
  }
  // set mode
  const numeric = (s?: string) => {
    if (!s) return Number.POSITIVE_INFINITY;
    const m = s.match(/(\d+)\s*$/);
    if (!m) return Number.POSITIVE_INFINITY;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  sorted.sort((a, b) => {
    const aHas = Boolean(a.setCode);
    const bHas = Boolean(b.setCode);
    if (aHas !== bHas) return aHas ? -1 : 1;
    const setCmp = (a.setCode ?? '').localeCompare(b.setCode ?? '');
    if (setCmp !== 0) return setCmp;
    const numCmp = numeric(a.collectorNumber) - numeric(b.collectorNumber);
    if (numCmp !== 0) return numCmp;
    return a.displayName.localeCompare(b.displayName);
  });
  return sorted;
}

export interface PoolRarityGroup {
  rarity: string;
  cards: PoolCard[];
}

export interface CardPool {
  cards: PoolCard[];
  byRarity: PoolRarityGroup[];
}

interface CapInput {
  types?: string[];
}

export interface KitOption {
  id: string;
  label: string;
}

export function buildKitOptions(lists: CuratedListDTO[]): KitOption[] {
  const heroes = new Set(lists.map(l => l.heroName).filter(Boolean));
  const multiHero = heroes.size > 1;
  return lists.map(l => ({
    id: l.id,
    label: multiHero && l.heroName ? `${l.heroName} · ${l.name}` : l.name,
  }));
}

export function capForCard(input: CapInput): number {
  const types = (input.types ?? []).map(t => t.toLowerCase());
  const has = (t: string) => types.includes(t);
  if (has('weapon')) return 2;
  if (has('equipment') && has('evo')) return 3;
  if (has('equipment')) return 1;
  return 3;
}

type CardWithMeta = CuratedListCardDTO;

interface ComputeOptions {
  listIdFilter?: string;
}

export function computeCardPool(lists: CuratedListDTO[], options: ComputeOptions = {}): CardPool {
  const filtered = options.listIdFilter
    ? lists.filter(l => l.id === options.listIdFilter)
    : lists;

  const byCard = new Map<string, PoolCard>();

  for (const list of filtered) {
    const perListCounts = new Map<string, number>();
    for (const c of list.cards ?? []) {
      const card = c as CardWithMeta;
      const key = card.cardUniqueId ?? card.printingId;
      perListCounts.set(key, (perListCounts.get(key) ?? 0) + 1);

      const existing = byCard.get(key);
      if (existing) {
        existing.rawCount += 1;
        if (!existing.comment && card.comment) existing.comment = card.comment;
      } else {
        const rarityCode = (card.rarity ?? '').toLowerCase();
        const rarityName = RARITY_MAP[rarityCode as RarityCode] ?? 'Unknown';
        byCard.set(key, {
          cardUniqueId: key,
          displayName: card.displayName ?? card.printingId,
          rarity: rarityName,
          rarityCode,
          types: card.types ?? [],
          keywords: card.keywords ?? [],
          facetTags: card.facetTags ?? [],
          imageUrl: card.imageUrl,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber,
          color: card.color,
          foiling: card.foiling,
          edition: card.edition,
          typeTextDisplay: card.typeTextDisplay,
          tcgLow: card.tcgLow,
          tcgMarket: card.tcgMarket,
          tcgMid: card.tcgMid,
          tcgHigh: card.tcgHigh,
          tcgplayerUrl: card.tcgplayerUrl,
          isExtendedArt: card.isExtendedArt,
          artVariations: card.artVariations,
          foilInsetTop: card.foilInsetTop,
          foilInsetRight: card.foilInsetRight,
          foilInsetBottom: card.foilInsetBottom,
          foilInsetLeft: card.foilInsetLeft,
          foilInsetRound: card.foilInsetRound,
          printingId: card.printingId,
          comment: card.comment ?? null,
          rawCount: 1,
          cappedCount: 0,
          cap: 0,
          sources: [],
        });
      }
    }
    for (const [key, count] of perListCounts) {
      const pc = byCard.get(key);
      if (pc) pc.sources.push({ listId: list.id, listName: list.name, heroName: list.heroName, count });
    }
  }

  for (const pc of byCard.values()) {
    pc.cap = capForCard({ types: pc.types });
    pc.cappedCount = Math.min(pc.rawCount, pc.cap);
  }

  const cards = Array.from(byCard.values());

  const byRarityMap = new Map<string, PoolCard[]>();
  for (const pc of cards) {
    const bucket = byRarityMap.get(pc.rarity) ?? [];
    bucket.push(pc);
    byRarityMap.set(pc.rarity, bucket);
  }
  for (const bucket of byRarityMap.values()) {
    bucket.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const byRarity: PoolRarityGroup[] = [];
  for (const rarity of RARITY_ORDER) {
    const bucket = byRarityMap.get(rarity);
    if (bucket && bucket.length > 0) byRarity.push({ rarity, cards: bucket });
  }
  for (const [rarity, bucket] of byRarityMap) {
    if (!RARITY_ORDER.includes(rarity)) byRarity.push({ rarity, cards: bucket });
  }

  return { cards, byRarity };
}

/**
 * Hero legality derivation for deck-scoped card searches. Moved out of
 * hooks/deck/useDeckEditor.ts so pure-lib consumers (QuickAddCardDialog's
 * filter builder) and the vitest node project can reach it.
 */

import { getHeroInfo } from '@/lib/fab-constants/heroes';
import { OFFICIAL_TALENTS } from '@/lib/talent-constants';
import type { DeckDTO } from '@/lib/services/contracts/IDeckService';

const TALENT_SET = new Set<string>(OFFICIAL_TALENTS);
const NON_CLASS_TYPES = new Set(['hero', 'young', 'adult', 'token', 'equipment', 'weapon',
  'action', 'attack', 'instant', 'defense reaction', 'attack reaction', 'demi-hero']);

const ESSENCE_ELEMENTS = ['lightning', 'earth', 'ice', 'fire', 'shadow', 'light', 'draconic', 'water'] as const;

export interface HeroFilter {
  heroClasses: string[];
  heroTalents: string[];
  heroEssences: string[];
}

function extractEssences(keywords: string[]): string[] {
  const combined = keywords.join(' ').toLowerCase();
  if (!combined.includes('essence')) return [];
  // Whole-word match: "essence of lightning" must NOT grant 'light' (substring).
  return ESSENCE_ELEMENTS.filter(el => new RegExp(`\\b${el}\\b`).test(combined));
}

export function resolveHeroFilter(deck: DeckDTO | null): HeroFilter | null {
  if (!deck) return null;
  // Strategy 1: derive from hero card in deck
  if (deck.hero?.length) {
    const h = deck.hero[0]?.printingDetails as any;
    if (h) {
      const directClasses = ((h.classes as string[] | undefined) || []).map((c: string) => c.toLowerCase()).filter(Boolean);
      const directTalents = ((h.talents as string[] | undefined) || []).map((t: string) => t.toLowerCase()).filter(Boolean);
      const heroEssences = extractEssences((h.keywords as string[] | undefined) || []);
      if (directClasses.length > 0 || directTalents.length > 0) return { heroClasses: directClasses, heroTalents: directTalents, heroEssences };
      // Derive from types array
      const heroTypes = ((h.types as string[] | undefined) || []).map((t: string) => t.toLowerCase());
      const classesFromTypes = heroTypes.filter(t => !TALENT_SET.has(t) && !NON_CLASS_TYPES.has(t));
      const talentsFromTypes = heroTypes.filter(t => TALENT_SET.has(t));
      if (classesFromTypes.length > 0 || talentsFromTypes.length > 0) return { heroClasses: classesFromTypes, heroTalents: talentsFromTypes, heroEssences };
    }
  }
  // Strategy 2: heroName lookup
  if (deck.heroName) {
    const info = getHeroInfo(deck.heroName);
    if (info) return { heroClasses: info.classes, heroTalents: info.talents, heroEssences: [] };
    // Strategy 3: treat heroName as a class name directly
    const nameLower = deck.heroName.toLowerCase();
    if (!TALENT_SET.has(nameLower) && !NON_CLASS_TYPES.has(nameLower)) return { heroClasses: [nameLower], heroTalents: [], heroEssences: [] };
  }
  return null;
}

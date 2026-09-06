import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

export type BuildStepKey = 'gear' | 'attacks' | 'defense' | 'utility';

export interface BuildStepProgress {
  current: number;
  target: number;
  complete: boolean;
}

export interface BuildProgress {
  steps: Record<BuildStepKey, BuildStepProgress>;
  totalCards: { current: number; target: number };
  overallComplete: boolean;
}

interface FormatTargets {
  gear: number;
  attacks: number;
  defense: number;
  utility: number;
  totalMaindeck: number;
}

const FORMAT_TARGETS: Record<string, FormatTargets> = {
  'classic constructed': {
    gear: 4,
    attacks: 24,
    defense: 15,
    utility: 12,
    totalMaindeck: 80,
  },
  'future classic constructed': {
    gear: 4,
    attacks: 24,
    defense: 15,
    utility: 12,
    totalMaindeck: 80,
  },
  'silver age': {
    gear: 4,
    attacks: 16,
    defense: 10,
    utility: 8,
    totalMaindeck: 55,
  },
  'blitz': {
    gear: 4,
    attacks: 15,
    defense: 10,
    utility: 8,
    totalMaindeck: 52,
  },
  'commoner': {
    gear: 4,
    attacks: 16,
    defense: 10,
    utility: 8,
    totalMaindeck: 55,
  },
};

const COMPLETE_THRESHOLD = 0.8;
const HERO_TYPES = new Set(['hero', 'young', 'adult', 'demi-hero']);

function categorize(printing: DeckPrintingDTO): BuildStepKey | 'hero' | 'unknown' {
  const types = (printing.printingDetails?.types || []).map((t) => t.toLowerCase());
  if (types.some((t) => HERO_TYPES.has(t))) return 'hero';
  if (types.includes('equipment') || types.includes('weapon')) return 'gear';
  if (types.includes('attack')) return 'attacks';
  if (types.includes('defense reaction')) return 'defense';
  if (types.includes('action')) return 'defense'; // v1: non-attack actions count toward defense (often used as blocks)
  if (
    types.includes('instant') ||
    types.includes('item') ||
    types.includes('ally') ||
    types.includes('attack reaction')
  ) {
    return 'utility';
  }
  return 'unknown';
}

function qty(p: DeckPrintingDTO): number {
  return p.quantity ?? 1;
}

export function computeBuildProgress(deck: DeckDTO, format: string): BuildProgress {
  const targets = FORMAT_TARGETS[format.toLowerCase()] ?? FORMAT_TARGETS['classic constructed'];

  const counts: Record<BuildStepKey, number> = { gear: 0, attacks: 0, defense: 0, utility: 0 };

  // Tally across the whole deck pool: equipment + maindeck + inventory.
  // Inventory is the sideboard/swap pool — including it lets users see how much
  // of a kit they already own across maindeck and side, surfacing real overlap.
  const allCards = [
    ...(deck.equipment ?? []),
    ...(deck.maindeck ?? []),
    ...(deck.inventory ?? []),
  ];
  for (const p of allCards) {
    const bucket = categorize(p);
    if (bucket === 'gear' || bucket === 'attacks' || bucket === 'defense' || bucket === 'utility') {
      counts[bucket] += qty(p);
    }
  }

  const totalCardsCurrent = allCards.reduce((sum, p) => sum + qty(p), 0);

  const buildStep = (key: BuildStepKey): BuildStepProgress => ({
    current: counts[key],
    target: targets[key],
    complete: counts[key] >= targets[key] * COMPLETE_THRESHOLD,
  });

  const steps = {
    gear: buildStep('gear'),
    attacks: buildStep('attacks'),
    defense: buildStep('defense'),
    utility: buildStep('utility'),
  };

  return {
    steps,
    totalCards: { current: totalCardsCurrent, target: targets.totalMaindeck },
    overallComplete: steps.gear.complete && steps.attacks.complete && steps.defense.complete && steps.utility.complete,
  };
}

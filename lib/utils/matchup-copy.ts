export interface CopyableMatchup {
  heroId: string;
  preferredTurnOrder: 'First' | 'Second' | 'NoPreference' | null;
  notes: string | null;
  sideboard: { in: string[]; out: string[] };
}

export interface HeroOption {
  talisharId: string;
  displayName: string;
}

export function getCopyTargets<T extends HeroOption>(
  sourceHeroId: string,
  matchups: { heroId: string }[],
  heroes: T[]
): T[] {
  const taken = new Set(matchups.map(m => m.heroId));
  return heroes.filter(h => h.talisharId !== sourceHeroId && !taken.has(h.talisharId));
}

export function buildCopiedMatchup(
  source: CopyableMatchup,
  targetHeroId: string
): CopyableMatchup {
  return {
    heroId: targetHeroId,
    preferredTurnOrder: source.preferredTurnOrder,
    notes: source.notes,
    sideboard: {
      in: [...source.sideboard.in],
      out: [...source.sideboard.out],
    },
  };
}

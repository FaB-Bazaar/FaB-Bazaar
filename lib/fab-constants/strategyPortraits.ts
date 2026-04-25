// lib/fab-constants/strategyPortraits.ts
// Stylized archetype portrait artwork for non-hero matchup strategies
// (core, aggro, fatigue, combo, midrange — see SPECIAL_MATCHUP_IDS in
// lib/validation/matchup-validation.ts).
// Files live at /public/strategies/<id>.webp (with original .png alongside).
// Run `npx tsx scripts/optimize-strategy-portraits.ts` after adding new portraits
// to regenerate the .webp variants.

export const STRATEGY_IDS = ['core', 'aggro', 'fatigue', 'combo', 'midrange'] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

const STRATEGY_DISPLAY_NAMES: Record<StrategyId, string> = {
  core: 'Core Plan',
  aggro: 'Aggro',
  fatigue: 'Fatigue',
  combo: 'Combo',
  midrange: 'Midrange',
};

const STRATEGY_PORTRAIT_IDS = new Set<string>(STRATEGY_IDS);

export function isStrategyId(id: string | null | undefined): id is StrategyId {
  return !!id && STRATEGY_PORTRAIT_IDS.has(id);
}

export function getStrategyPortraitUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return STRATEGY_PORTRAIT_IDS.has(id) ? `/strategies/${id}.webp` : null;
}

export function getStrategyDisplayName(id: StrategyId): string {
  return STRATEGY_DISPLAY_NAMES[id];
}

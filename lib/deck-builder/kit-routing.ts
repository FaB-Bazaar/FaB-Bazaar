import type { BuildStepKey } from './build-progress';

interface NamedKit {
  name: string;
}

// Ordered keyword preferences per step. The first kit whose name matches any
// keyword in this list (case-insensitive) wins, with earlier keywords preferred
// when multiple kits match.
const STEP_KEYWORDS: Record<BuildStepKey, string[]> = {
  gear: ['equipment', 'weapon'],
  attacks: ['attack action', 'attack'],
  defense: ['defense reaction', 'block', 'defense'],
  utility: ['non-attack', 'utility', 'allies', 'ally', 'gem', 'resource', 'instant', 'item'],
};

export function pickKitForStep<T extends NamedKit>(step: BuildStepKey, kits: T[]): T | null {
  if (!kits.length) return null;
  const keywords = STEP_KEYWORDS[step];
  for (const keyword of keywords) {
    const match = kits.find((k) => k.name.toLowerCase().includes(keyword));
    if (match) return match;
  }
  return null;
}

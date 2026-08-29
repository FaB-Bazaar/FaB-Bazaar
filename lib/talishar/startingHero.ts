/**
 * Resolve the hero a Talishar player STARTED the game as.
 *
 * Talishar's `playerHero` / `opposingHero` fields are a snapshot of the hero at
 * game end. Heroes that transform mid-game (Teklovossen → the Mechropotent,
 * Arakni Marionette/Web of Deceit → a random "agent of chaos" demi-hero such as
 * Redback or Orb-Weaver, Levia → Blasmophet) therefore report the transformed
 * form — a demi-hero nobody can actually start as. The `character` array keeps
 * the original hero card as its first entry, so that is the identity every
 * matchup rollup should key on.
 */

export interface TalisharCharacterEntry {
  cardId?: string;
  cardName?: string;
  numCopies?: number;
}

export interface TalisharHeroSource {
  playerHero?: string;
  character?: TalisharCharacterEntry[] | null;
}

export function resolveStartingHero(entry: TalisharHeroSource | null | undefined): string | undefined {
  if (!entry) return undefined;
  const first = Array.isArray(entry.character) ? entry.character[0]?.cardId : undefined;
  if (typeof first === 'string' && first.length > 0) return first;
  return entry.playerHero || undefined;
}

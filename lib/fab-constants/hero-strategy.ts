/**
 * Curated, short hero strategy primers — authoritative game-plan context the
 * model can't reliably infer (and often gets wrong) for a specific hero. Used
 * by the get_results MCP tool to ground game analysis.
 *
 * These are hand-written (not scraped) so they stay correct. Keep each concise.
 * Add heroes as primers are written. Keyed by the Talishar hero slug emitted in
 * game_results (self.playerHero / opponent.playerHero), with aliases for the
 * hero's multiple forms.
 */

interface HeroPrimer {
  /** Talishar hero slugs (and loose name fragments) that map to this primer. */
  aliases: string[];
  primer: string;
}

const HERO_PRIMERS: HeroPrimer[] = [
  {
    aliases: ['teklovossen_the_mechropotent', 'teklovossen_esteemed_magnate', 'teklovossen'],
    primer: [
      'Teklovossen — Mechanologist Evo engine; value-control that SCALES the longer the game goes (but respect the opponent\'s clock).',
      'Plan: equip base equipment, then transform pieces into Evo Steel Soul equipment. Each equipped Evo scales the deck (Teklo Leveler cheaper/+power/go again; Terminator Tank & War Machine cheaper + overpower/+3; Ghost Protocol: Mainframe +1 per Evo). The hero plays Evos from the banished zone and as instants on the opponent\'s turn while drawing.',
      'Blocking nuance (important): block aggressively with BASE equipment to use up its defense before transforming it — BUT Evo Steel Souls have TEMPER and are destroyed if you block away all their defense, so don\'t fully block with the Evos you need equipped. Fabricate is a one-time tool to maximize block value; arsenaling Fabricate the turn before Singularity lets your equipment block a lot.',
      'Weapon: Teklo Leveler is excellent — at 3-4 Evos it\'s a 1-resource, go-again attack that pressures decks that want to block; a real clock in the late game.',
      'Pitch & sequencing: track what BOTH players have pitched — those cards return later (plan future turns around it). Ghost Protocol: Architect searches AND shuffles, so use it early, before you start pitch-stacking for big turns.',
      'Singularity (finisher): transforms hero + weapon + 4 Evos into Teklovossen, the Mechropotent. Evo Steel Soul triggers fire TWICE through Singularity; the Beta (base) steel souls have no meaningful trigger but still satisfy the 4-Evo requirement. Want at minimum chest + legs on Evo Steel Soul (gives 6 resources + 2 action points to pressure the turn you transform). Head and arm are high-impact, but WITHOUT the legs (boots) you usually lose to the crackback unless you\'re far enough ahead they can\'t pressure back.',
      'Weak to: equipment disruption; losing the race to fast go-wide decks (e.g. Kassai). Survive early, win the long value game, be threatening before their nut turn.',
    ].join('\n'),
  },
];

/** Resolve a Talishar hero slug to its curated primer, or null if none exists. */
export function getHeroPrimer(slug?: string | null): string | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  for (const h of HERO_PRIMERS) {
    if (h.aliases.some((a) => s === a || s.includes(a))) return h.primer;
  }
  return null;
}

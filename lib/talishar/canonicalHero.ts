/**
 * Read-time normalisation of Talishar hero ids.
 *
 * Talishar's `playerHero` / `opposingHero` are a snapshot of the hero at GAME
 * END, so a hero that transformed mid-game is reported as its transformed form:
 * Teklovossen → the Mechropotent, Levia → Blasmophet / Levia Redeemed, Arakni
 * Marionette / Web of Deceit → a random "agent of chaos" demi-hero (Redback,
 * Orb-Weaver, Black Widow, …). None of those can be a STARTING hero, and a
 * matchup rollup keyed on them splits one hero across several buckets.
 *
 * game_results keeps whatever Talishar sent (older rows have no archived
 * payload to recover the starting hero from), and every read path maps through
 * `canonicalHeroId` instead. A transformed form has an adult and a young base
 * hero; the game's Talishar format code decides which.
 *
 * Format codes: Talishar `Libraries/PlayerSettings.php` FormatCode() —
 *   0 cc · 1 compcc · 2 blitz · 3 compblitz · 4 futurecc · 5 commoner ·
 *   6 sealed · 7 draft · 8 llcc · 9 llblitz · 10 openformatblitz · 11 futurell ·
 *   12 openformatllblitz · 13 compllcc · 14 sage · 15 compsage · 16 futuresage ·
 *   17 open · 18 gage · -1 clash · -2 precon
 * Codes not listed as young below (incl. sealed/draft/gage/precon, whose hero
 * age isn't fixed) default to the adult form — CC is the dominant format.
 */

const YOUNG_FORMAT_CODES = new Set(['2', '3', '5', '9', '10', '12', '14', '15', '16']);

export function isYoungTalisharFormat(format: string | number | null | undefined): boolean {
  if (format == null) return false;
  return YOUNG_FORMAT_CODES.has(String(format));
}

interface BaseHero {
  adult: string;
  young: string;
}

const ARAKNI: BaseHero = { adult: 'arakni_marionette', young: 'arakni_web_of_deceit' };
const TEKLOVOSSEN: BaseHero = { adult: 'teklovossen_esteemed_magnate', young: 'teklovossen' };
const LEVIA: BaseHero = { adult: 'levia_shadowborn_abomination', young: 'levia' };

// Talishar id of a transformed form → the hero it transformed from.
export const TRANSFORMED_HERO_FORMS: Readonly<Record<string, BaseHero>> = {
  arakni_black_widow: ARAKNI,
  arakni_funnel_web: ARAKNI,
  arakni_orb_weaver: ARAKNI,
  arakni_redback: ARAKNI,
  arakni_tarantula: ARAKNI,
  arakni_trap_door: ARAKNI,
  teklovossen_the_mechropotent: TEKLOVOSSEN,
  blasmophet_levia_consumed: LEVIA,
  levia_redeemed: LEVIA,
};

export function canonicalHeroId<T extends string | null | undefined>(
  heroId: T,
  format?: string | number | null
): T {
  if (!heroId) return heroId;
  const base = TRANSFORMED_HERO_FORMS[heroId];
  if (!base) return heroId;
  return (isYoungTalisharFormat(format) ? base.young : base.adult) as T;
}

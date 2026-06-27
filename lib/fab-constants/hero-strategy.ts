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
      'How it actually wins: it is a CONTROL deck — block a lot (many defense reactions) until you can land big disruptive Overpower attacks, then close. A haymaker (Terminator Tank / War Machine, ~9) getting fully blocked by several cards is FINE — you are forcing tempo and card spend while Singularity grinds their deck out via fatigue. Disruption suite: Pulsewave Protocol strips a card from hand (take their key blue/non-attack); War Machine and Terminator Tank destroy arsenal and can pre-empt a combo pop-off turn; Ripple Away discards the opponent\'s setup off pitch (counters, tokens, runechants, key actions) — sequence these to deny their nut turns.',
      'Removal caveat (extends temper): do NOT defend with EQUIPPED Steel Soul Evos into Shred / Tarantula Toxin / destruction effects unless you can immediately re-equip a replacement via the hero ability — those punish your defensive equipment and can blow you out.',
      'Matchups — meta-dependent ANTI-META pick: thrives vs Guardian, fatigue, and slower/defensive fields, and grinds out many aggressive/midrange decks (Warriors like Kassai, Victor, Vynnset, Boltyn, Dorinthea, Katsu). Struggles vs Oscilio (only realistic win is fatigue — dig for Amulet of Echoes / Arcane Barrier tech), Prism and Gravy Bones (go-wide board overwhelm), reaction-speed aggro with Shred (e.g. Mario), and Illusionists / Zyggy. Survive early, win the long value game, and know where your Singularity is before making risky blocks.',
    ].join('\n'),
  },
  {
    aliases: ['kassai_of_the_golden_sand', 'kassai'],
    primer: [
      'Kassai of the Golden Sand — Volcor Warrior; fast go-wide tempo/aggro on a self-fueling gold engine. Gets scarier the longer the game runs.',
      'Plan: pressure early and often with dual Cintari Sabers (multiple weapon activations per turn) and Cintari Sellsword tokens to go wide. Her hero ability banishes 2 red + 2 yellow from the graveyard to make a Gold token when a weapon hits; Gold converts spent cards into draw and free sword activations — a snowball that compounds over the game. Spoils of War + Gold turn the mid-to-late game into burst. Wins by racing, fatigue, punishing nut go-wide turns, and well-timed attack reactions.',
      'Playing AGAINST Kassai (key): do NOT block her weapon attacks with ATTACK ACTION cards — Hot Streak gains go again and Cintari Saber gains +power when defended by an attack action, so you actively power her engine. Block with equipment / defense reactions, or take the hit. Deny Gold value where you can, and disrupt her arsenal / banked weapon reactions (on-hit arsenal destruction is real disruption).',
      'She scales with the gold economy (especially ~turn 12+), so be threatening lethal before she stabilizes — racing her before the engine comes online is the classic answer. Weak to: color-consistency hiccups, graveyard disruption, and simply being outraced early.',
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

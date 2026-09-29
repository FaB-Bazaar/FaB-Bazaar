// lib/deck/deckbuilding-guide.ts
// Text for the get_deckbuilding_guide MCP tool. Pure — no service imports —
// so the tool (and tests) pass in whatever hero-card data they fetched.
//
// Why a tool and not a resource: of every MCP client in mcp_usage_daily only
// Claude ever reads resources, and third-party hosts (Meta Muse) are the main
// deckbuilders. Guidance an agent will actually see has to come back from a
// tool call. Format numbers come from CONSTRUCTED_FORMAT_RULES — never
// restate them here.

import { HERO_INFO, YOUNG_HERO_INFO, type HeroInfo } from '@/lib/fab-constants/heroes-rosters';
import { classifyHeroName, validateHeroFormatLegality } from '@/lib/fab-constants/heroes';
import { getFormatRules, type FormatRules } from './format-rules';

export const GUIDE_FORMATS = [
  'Classic Constructed',
  'Silver Age',
  'Blitz',
  'Commoner',
  'Living Legend',
  'Limited',
  'Ultimate Pit Fight',
  'Casual',
] as const;

// validateHeroFormatLegality's snake-case keys.
const FORMAT_SNAKE: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Living Legend': 'll',
  Blitz: 'blitz',
  'Silver Age': 'silver_age',
  Commoner: 'commoner',
};

export interface GuideHero {
  canonical: string;
  age: 'adult' | 'young';
  info: HeroInfo;
}

export interface GuideHeroCard {
  text?: string | null;
  health?: number | null;
}

export function resolveGuideHero(name: string): GuideHero | null {
  const { age, canonical } = classifyHeroName(name);
  if (age === 'adult') return { canonical, age, info: HERO_INFO[canonical] };
  if (age === 'young') return { canonical, age, info: YOUNG_HERO_INFO[canonical] };
  return null;
}

export type GuideResult =
  | { ok: true; text: string; hero?: GuideHero }
  | { ok: false; error: string };

export function buildDeckbuildingGuide(input: {
  format: string;
  heroName?: string;
  heroCard?: GuideHeroCard | null;
}): GuideResult {
  const format = GUIDE_FORMATS.find(f => f.toLowerCase() === input.format.trim().toLowerCase());
  if (!format) {
    return { ok: false, error: `Unknown format "${input.format}". Use one of: ${GUIDE_FORMATS.join(', ')}.` };
  }

  let hero: GuideHero | undefined;
  if (input.heroName?.trim()) {
    hero = resolveGuideHero(input.heroName) ?? undefined;
    if (!hero) {
      return {
        ok: false,
        error: `Unknown hero "${input.heroName}". Use the lowercase canonical name from the create_deck heroName enum (e.g. "dorinthea ironsong", or "dorinthea" for the young hero).`,
      };
    }
  }

  const rules = getFormatRules(format);
  const sections = [
    `# Deckbuilding guide: ${format}${hero ? ` / ${hero.canonical}` : ''}`,
    readTheCardsSection(),
    rules ? rulesSection(format, rules) : freeFormSection(format),
    hero ? heroSection(format, hero, input.heroCard ?? null) : null,
    methodSection(format, rules),
    selfCheckSection(rules),
  ].filter(Boolean);

  return { ok: true, text: sections.join('\n\n'), hero };
}

function readTheCardsSection(): string {
  return [
    '## 1. Read the cards (non-negotiable)',
    '- Never infer what a card does from its name, art or theme. Read its rules text before you add it, cut it, or explain why it is in the deck.',
    '- Get the text: `search_printings` with `options.includeText: true` (on by default when you filter by `heroLegal` or `format`), or `get_deck` with `includeText: true` for a whole list.',
    '- Two cards sharing a word ("Command and Conquer", "Command") share nothing mechanically unless their text says so. Justify every synergy by quoting the text that creates it.',
    '- Each pitch of a card is a separate card with its own numbers: red/yellow/blue versions differ in power, block or effect size, and each counts separately toward the copy limit.',
    '- Use the stats the tools return (cost, power, defense, pitch, health). Do not guess them from memory.',
  ].join('\n');
}

function rulesSection(format: string, rules: FormatRules): string {
  const deck = 'exact' in rules.deckSize
    ? `exactly ${rules.deckSize.exact} cards in the deck`
    : `at least ${rules.deckSize.min} cards in the deck`;
  const copies = rules.maxCopies === 1 ? '1 copy' : `${rules.maxCopies} copies`;
  return [
    `## 2. ${format} construction rules (official)`,
    `- Hero: 1 ${rules.heroAge} hero.`,
    `- Card pool: up to ${rules.maxCardPool} cards (weapons + equipment + deck cards; the hero does not count).`,
    `- Deck: ${deck} at the start of each game. Everything else in the pool is inventory (the sideboard, zone \`inventory\`).`,
    `- Up to ${copies} of each unique card. A unique card is name + pitch color, and weapons and equipment count too.`,
    ...rules.notes.map(n => `- ${n}`),
    '- Banned and suspended cards: `search_printings` with `format` excludes them; `add_cards_to_deck` rejects them.',
  ].join('\n');
}

function freeFormSection(format: string): string {
  return [
    `## 2. ${format} construction rules`,
    `- ${format} has no fixed construction rules enforced here (no copy limit, no pool size). Agree on the rules with your playgroup or event, and still read every card.`,
  ].join('\n');
}

function heroSection(format: string, hero: GuideHero, card: GuideHeroCard | null): string {
  const { info } = hero;
  const lines = [
    `## 3. Hero: ${hero.canonical} (${hero.age})`,
    `- Classes: ${info.classes.join(', ') || 'none'}. Talents: ${info.talents.join(', ') || 'none'}.${info.essences?.length ? ` Essences: ${info.essences.join(', ')}.` : ''}`,
  ];

  const snake = FORMAT_SNAKE[format];
  if (snake) {
    const legality = validateHeroFormatLegality(hero.canonical, snake);
    if (!legality.ok) lines.push(`- ⚠️ ${legality.error}`);
  }

  if (card?.text) {
    lines.push(`- Hero text: ${card.text.replace(/\s+/g, ' ').trim()}`);
    if (typeof card.health === 'number') lines.push(`- Life ${card.health}.`);
    lines.push('- Build around what this text actually rewards: what it triggers on, what it counts, and what it needs you to do each turn.');
  } else {
    lines.push('- The hero card could not be loaded here. Read it first: `search_printings` with `filters.types: ["hero"]`, the hero name, and `options.includeText: true`.');
  }

  lines.push(
    '- A card is legal for this hero when its classes and talents are a SUBSET of the hero\'s. "Pirate Necromancer Action" needs both classes. A type line with a slash ("Brute / Guardian") is a hybrid: either side matching is enough. Generic cards fit every hero.',
    '- `search_printings` with `filters.heroLegal` applies this rule for you.',
  );
  return lines.join('\n');
}

function methodSection(format: string, rules: FormatRules | null): string {
  const deckSize = rules && 'exact' in rules.deckSize ? rules.deckSize.exact : rules && 'min' in rules.deckSize ? rules.deckSize.min : null;
  return [
    '## 4. Method',
    '1. Read the hero card and decide the game plan it supports: aggressive, midrange, control or combo, and which turn you win on.',
    '2. Pick the core: cards whose TEXT advances that plan. Look at the facet tags (`facetTags`) and the Decks to Beat (`get_decks_to_beat`) for what currently works, then read each card before taking it.',
    '3. Resource math. Each card you play is paid for by pitching others: red pitches 1, yellow 2, blue 3. Add up the costs you plan to pay per turn and check the pitch mix covers them. A deck of 0-1 cost attacks can run mostly red; expensive cards and defense reactions need yellows and blues.',
    '4. Defense. Count cards with printed defense and the defense reactions. Decide what you block with and what you hold.',
    '5. Arena: weapon(s), then one equipment per slot (head, chest, arms, legs) for the main game plan. Put alternative pieces and matchup cards in inventory.',
    `6. Fill the deck${deckSize ? ` to ${deckSize}` : ''}, then build inventory from real matchup needs. For each sideboard plan, \`save_deck_matchup\` records the in/out swaps.`,
  ].join('\n');
}

function selfCheckSection(rules: FormatRules | null): string {
  return [
    '## 5. Self-check before presenting the deck',
    '- Did you read the text of every card you added? Could you quote why each one is in?',
    '- Does every synergy you claim come from card text, not from names?',
    rules ? `- Deck size, pool size (${rules.maxCardPool}) and copy limit (${rules.maxCopies}) respected?` : '- Card counts agreed for this format?',
    '- Is the pitch mix enough to pay for your most expensive turn?',
    '- Verify with `get_deck` (`includeText: true`) and fix anything that does not match the plan.',
  ].join('\n');
}

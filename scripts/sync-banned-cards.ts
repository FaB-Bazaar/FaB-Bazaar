#!/usr/bin/env npx ts-node
/**
 * scripts/sync-banned-cards.ts
 *
 * Fetches ban list and Living Legend data from the flesh-and-blood-cards repo
 * and regenerates lib/fab-banned-cards.ts.
 *
 * Usage:
 *   npx ts-node scripts/sync-banned-cards.ts
 *   npx ts-node scripts/sync-banned-cards.ts --dry-run   (print diff, don't write)
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english';

interface BanEntry {
  card_unique_id: string;
  status_active: boolean;
  date_in_effect: string;
}

interface LLEntry {
  card_unique_id: string;
  status_active: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** Last entry per card_unique_id wins (by date or array order). */
function computeActive(entries: BanEntry[]): BanEntry[] {
  const latest = new Map<string, BanEntry>();
  for (const e of entries) {
    const existing = latest.get(e.card_unique_id);
    if (!existing || new Date(e.date_in_effect) >= new Date(existing.date_in_effect)) {
      latest.set(e.card_unique_id, e);
    }
  }
  return [...latest.values()];
}

/** For LL entries without dates — last entry per card wins. */
function computeActiveLl(entries: LLEntry[]): string[] {
  const latest = new Map<string, boolean>();
  for (const e of entries) {
    latest.set(e.card_unique_id, e.status_active);
  }
  return [...latest.entries()].filter(([, active]) => active).map(([id]) => id);
}

function banListTs(varName: string, sourceFile: string, entries: BanEntry[]): string {
  const lines = entries.map(e =>
    `  { card_unique_id: "${e.card_unique_id}", status_active: ${e.status_active}, date_in_effect: "${e.date_in_effect}" },`
  );
  return `// Source: json/english/${sourceFile}\nconst ${varName}: BanEntry[] = [\n${lines.join('\n')}\n];\n`;
}

function llListTs(varName: string, sourceFile: string, ids: string[]): string {
  const lines = ids.map(id => `  "${id}",`);
  return `// Source: json/english/${sourceFile}\nconst ${varName}: string[] = [\n${lines.join('\n')}\n];\n`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching ban lists...');
  const [ccBans, sageBans, llCc, llBlitz] = await Promise.all([
    fetchJson<BanEntry[]>(`${BASE_URL}/banned-cc.json`),
    fetchJson<BanEntry[]>(`${BASE_URL}/banned-silver-age.json`),
    fetchJson<LLEntry[]>(`${BASE_URL}/living-legend-cc.json`),
    fetchJson<LLEntry[]>(`${BASE_URL}/living-legend-blitz.json`),
  ]);

  // Deduplicate keeping latest entry per card
  const ccDeduped = computeActive(ccBans);
  const sageDeduped = computeActive(sageBans);
  const llCcIds = computeActiveLl(llCc);
  const llBlitzIds = computeActiveLl(llBlitz);

  console.log(`CC bans: ${ccDeduped.length} active ban entries`);
  console.log(`Silver Age bans: ${sageDeduped.length} active ban entries`);
  console.log(`CC Living Legend heroes: ${llCcIds.length}`);
  console.log(`Blitz Living Legend heroes: ${llBlitzIds.length}`);

  const output = `// lib/fab-banned-cards.ts
// Banned card lists and Living Legend hero exclusions for FaB formats.
// Run \`npx ts-node scripts/sync-banned-cards.ts\` to refresh from upstream.
// Source: https://github.com/the-fab-cube/flesh-and-blood-cards
//
// Each BanEntry has status_active: true (banned) or false (unbanned).
// When a card has multiple entries, the latest date_in_effect determines current status.

interface BanEntry {
  card_unique_id: string;
  status_active: boolean;
  date_in_effect: string;
}

// Classic Constructed banned list
${banListTs('CC_BAN_LIST', 'banned-cc.json', ccBans)}
// Silver Age banned list
${banListTs('SAGE_BAN_LIST', 'banned-silver-age.json', sageBans)}
// Blitz has no banned cards.
// Format rule: max 1 copy of any non-token card (vs 3 for CC/Silver Age).

// Heroes that have achieved Living Legend status in CC — excluded from the CC hero selector.
${llListTs('CC_LIVING_LEGEND_HEROES', 'living-legend-cc.json', llCcIds)}
// Heroes that have achieved Living Legend status in Blitz — excluded from the Blitz hero selector.
// (computed: last entry per hero wins)
${llListTs('BLITZ_LIVING_LEGEND_HEROES', 'living-legend-blitz.json', llBlitzIds)}
/**
 * Compute the currently-banned card_unique_ids from a ban list.
 * Groups entries by card_unique_id, takes the latest date_in_effect,
 * and returns cards where the latest entry has status_active: true.
 */
function computeActiveBans(banList: BanEntry[]): Set<string> {
  const latestByCard = new Map<string, BanEntry>();

  for (const entry of banList) {
    const existing = latestByCard.get(entry.card_unique_id);
    if (!existing || new Date(entry.date_in_effect) >= new Date(existing.date_in_effect)) {
      latestByCard.set(entry.card_unique_id, entry);
    }
  }

  const banned = new Set<string>();
  for (const [cardId, entry] of latestByCard) {
    if (entry.status_active) {
      banned.add(cardId);
    }
  }
  return banned;
}

// Pre-computed sets for fast lookup
const CC_BANNED_CARDS = computeActiveBans(CC_BAN_LIST);
const SAGE_BANNED_CARDS = computeActiveBans(SAGE_BAN_LIST);
const CC_LIVING_LEGEND_SET = new Set(CC_LIVING_LEGEND_HEROES);
const BLITZ_LIVING_LEGEND_SET = new Set(BLITZ_LIVING_LEGEND_HEROES);

/**
 * Get the set of currently-banned card_unique_ids for a format.
 */
export function getBannedCardIds(format: string): Set<string> {
  const f = format.toLowerCase();
  if (f === 'classic constructed' || f === 'cc') return CC_BANNED_CARDS;
  if (f === 'silver age' || f === 'sage') return SAGE_BANNED_CARDS;
  // Blitz has no banned cards
  return new Set();
}

/**
 * Check if a card_unique_id is banned in a given format.
 */
export function isCardBanned(cardUniqueId: string, format: string): boolean {
  return getBannedCardIds(format).has(cardUniqueId);
}

/**
 * Get the set of hero card_unique_ids that have achieved Living Legend status
 * and should be excluded from the hero selector for a given format.
 */
export function getLivingLegendHeroIds(format: string): Set<string> {
  const f = format.toLowerCase();
  if (f === 'classic constructed' || f === 'cc') return CC_LIVING_LEGEND_SET;
  if (f === 'blitz') return BLITZ_LIVING_LEGEND_SET;
  return new Set();
}

/**
 * Check if a hero card_unique_id has achieved Living Legend status in a format.
 */
export function isHeroLivingLegend(heroCardUniqueId: string, format: string): boolean {
  return getLivingLegendHeroIds(format).has(heroCardUniqueId);
}

/**
 * Maximum number of copies of any non-token card allowed in a deck for a format.
 * Blitz: 1, all others: 3.
 */
export function getMaxCopiesPerCard(format: string): number {
  if (format.toLowerCase() === 'blitz') return 1;
  return 3;
}
`;

  const outPath = path.join(__dirname, '..', 'lib', 'fab-banned-cards.ts');

  if (dryRun) {
    console.log('\n--- Generated output (dry run) ---\n');
    console.log(output);
  } else {
    fs.writeFileSync(outPath, output, 'utf-8');
    console.log(`\nWrote ${outPath}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

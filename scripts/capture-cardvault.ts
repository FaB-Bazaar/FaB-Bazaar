#!/usr/bin/env npx tsx
/**
 * scripts/capture-cardvault.ts
 *
 * Drives Chromium via Playwright to walk a list of card names on
 * cardvault.fabtcg.com. For each name:
 *   1. Visits the search results URL.
 *   2. Clicks the card tile whose <img alt> exactly matches the name.
 *   3. Captures the JSON response from /carddb/api/v1/card_id/<slug>/ —
 *      same shape as one page of fabtcgcards.json.
 *   4. Saves the response verbatim to <out-dir>/<slug>.json.
 *
 * Idempotent: skips cards whose output file already exists.
 * Polite: real browser context, configurable delay between cards (default 1500ms).
 *
 * Usage:
 *   npx tsx scripts/capture-cardvault.ts                            # defaults
 *   npx tsx scripts/capture-cardvault.ts --input=/path/to/list.txt
 *   npx tsx scripts/capture-cardvault.ts --out=/Users/eko/fabtcg/captures
 *   npx tsx scripts/capture-cardvault.ts --headed                   # visible browser
 *   npx tsx scripts/capture-cardvault.ts --max=10                   # first N cards
 *   npx tsx scripts/capture-cardvault.ts --delay=2500               # ms between cards
 *
 * The input file is one card name per line. Blank lines and lines
 * starting with '#' are skipped.
 */

import { chromium, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (flag: string, fallback?: string) =>
  argv.find((a) => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=') ?? fallback;

const INPUT_FILE = arg('--input', '/tmp/majestic-generic-untranslated.txt')!;
const OUT_DIR = arg('--out', '/Users/eko/fabtcg/captures')!;
const HEADED = argv.includes('--headed');
const MAX = arg('--max') ? parseInt(arg('--max')!, 10) : undefined;
const DELAY_MS = arg('--delay') ? parseInt(arg('--delay')!, 10) : 1500;
// When true, input is treated as collector_numbers (e.g. ARC029, WTR087).
// Search narrows to ~1 result; we click the first non-UI tile without
// trying to match alt text by name. Output filename uses the collector.
const BY_COLLECTOR = argv.includes('--by-collector');

const SEARCH_URL = (q: string) =>
  `https://cardvault.fabtcg.com/results/?q=${encodeURIComponent(q)}`;

// The SPA fetches the card payload from this URL when you land on a card detail page.
const CARD_API_PATTERN = '/carddb/api/v1/card_id/';

function slugify(name: string): string {
  // Transliterate special characters first (ð → d, etc.) so the filename
  // matches Card Vault's canonical slug for the same card.
  return transliterate(name)
    .toLowerCase()
    .replace(/[''"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadNames(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

// Known UI image alts — filtered out when collecting candidate card tiles.
const UI_ALTS = new Set([
  'Flesh and Blood', 'menu', 'Small Grid', 'Medium Grid', 'Large Grid', 'List View', 'Flip',
  'search', 'Advanced Search', 'Syntax Guide', 'Products', 'Random Card',
  'language switcher', 'lang icon down',
  'Dropdown Arrow', 'Retailers Logo',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]/g, '');                         // strip punctuation/whitespace
}

/**
 * Locate the card tile whose <img alt> represents this card, with several
 * fallback strategies for Card Vault's naming quirks:
 *   - DFC `// X // Y` cards → tile alt uses `X||Y`
 *   - Back-face cards → tile alt is the front-face name (e.g. "Invoke Dominia")
 *   - Comma / spacing differences → e.g. "Arakni Huntsman" vs "Arakni, Huntsman"
 *   - Diacritics → tile alt may strip them
 *
 * Returns the alt of the tile we clicked, or null if nothing matched.
 */
async function findAndClickTile(page: Page, name: string): Promise<string | null> {
  await page.waitForTimeout(2_500); // let the SPA render results

  const alts: string[] = await page.$$eval('img', (els) =>
    els
      .map((e) => (e as HTMLImageElement).alt)
      .filter((a): a is string => !!a),
  );
  const candidates = alts.filter((a) => !UI_ALTS.has(a));
  if (candidates.length === 0) return null;

  const target = normalize(name);
  const dfcSwapped = name.includes(' // ') ? name.replace(/ \/\/ /g, '||') : null;
  const noComma = name.includes(',') ? name.replace(/,/g, '') : null;

  // Try matchers in priority order
  const tryStrategies: Array<() => string | undefined> = [
    () => candidates.find((a) => a === name),                                  // exact
    () => (dfcSwapped ? candidates.find((a) => a === dfcSwapped) : undefined), // DFC // → ||
    () => candidates.find((a) => a === `Invoke ${name}`),                      // back-face Invoke
    () => candidates.find((a) => a === `Construct ${name}`),                   // back-face Construct
    () => (noComma ? candidates.find((a) => a === noComma) : undefined),       // strip comma
    () => candidates.find((a) => normalize(a) === target),                     // normalized exact
    () => candidates.find((a) => normalize(a).includes(target)),               // normalized substring
  ];

  for (const strat of tryStrategies) {
    const match = strat();
    if (match) {
      await page.locator(`img[alt="${match.replace(/"/g, '\\"')}"]`).first().click();
      return match;
    }
  }
  return null;
}

// Manual transliteration map for characters that NFKD doesn't decompose.
// Card Vault's full-text search accepts ASCII fallbacks (e.g. "Vetreidi" finds
// "Vetreiði"), so this kicks in only when the name has one of these letters.
const TRANSLIT: Record<string, string> = {
  'ð': 'd', 'Ð': 'D', 'þ': 'th', 'Þ': 'Th',
  'æ': 'ae', 'Æ': 'Ae', 'œ': 'oe', 'Œ': 'Oe',
  'ø': 'o', 'Ø': 'O', 'ß': 'ss',
};
function transliterate(s: string): string {
  const nfkd = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return Array.from(nfkd).map((c) => TRANSLIT[c] ?? c).join('');
}

/**
 * Click the FIRST non-UI tile on the page (used in --by-collector mode where
 * the search is narrow and we don't need to match by name).
 */
async function clickFirstNonUiTile(page: Page): Promise<string | null> {
  await page.waitForTimeout(2_500);
  const alts: string[] = await page.$$eval('img', (els) =>
    els.map((e) => (e as HTMLImageElement).alt).filter((a): a is string => !!a),
  );
  const candidate = alts.find((a) => !UI_ALTS.has(a));
  if (!candidate) return null;
  await page.locator(`img[alt="${candidate.replace(/"/g, '\\"')}"]`).first().click();
  return candidate;
}

async function captureOne(page: Page, name: string): Promise<{ ok: boolean; payload?: any; reason?: string }> {
  // --by-collector: input IS the search query (collector_number). Single
  // attempt, no fuzzy fallbacks, click first non-UI tile.
  if (BY_COLLECTOR) {
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(CARD_API_PATTERN) && r.status() === 200,
      { timeout: 15_000 },
    ).catch(() => null);
    await page.goto(SEARCH_URL(name), { waitUntil: 'domcontentloaded' });
    const matchedAlt = await clickFirstNonUiTile(page);
    if (!matchedAlt) return { ok: false, reason: 'no tiles on page' };
    const response = await responsePromise;
    if (!response) return { ok: false, reason: 'card_id API response not seen within 15s' };
    try {
      return { ok: true, payload: await response.json() };
    } catch (e) {
      return { ok: false, reason: `response JSON parse failed: ${(e as Error).message}` };
    }
  }

  // Card Vault supports a `name="X"` syntax that does an EXACT name match
  // (avoids the full-text soup that hits common phrases like "Chain Reaction").
  // Try it first; fall back to bare full-text for cards LSS may store under
  // a different canonical name (e.g. DFCs that use `||` in storage but `//`
  // in our DB).
  const queries: string[] = [`name="${name}"`, name];
  const quoted = `"${name}"`;
  if (!queries.includes(quoted)) queries.push(quoted);
  const ascii = transliterate(name);
  if (ascii !== name) queries.push(`name="${ascii}"`, ascii);

  for (const q of queries) {
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(CARD_API_PATTERN) && r.status() === 200,
      { timeout: 15_000 },
    ).catch(() => null);

    await page.goto(SEARCH_URL(q), { waitUntil: 'domcontentloaded' });
    const matchedAlt = await findAndClickTile(page, name);
    if (!matchedAlt) {
      // Don't even bother waiting for a response — no click happened
      continue;
    }

    const response = await responsePromise;
    if (!response) continue;
    try {
      const payload = await response.json();
      return { ok: true, payload };
    } catch (e) {
      return { ok: false, reason: `response JSON parse failed: ${(e as Error).message}` };
    }
  }
  return { ok: false, reason: `no tile matched across ${queries.length} query variant(s)` };
}

async function main() {
  if (!existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  let names = loadNames(INPUT_FILE);
  if (MAX != null) names = names.slice(0, MAX);
  console.log(`Will process ${names.length} card(s)`);
  console.log(`  input:  ${INPUT_FILE}`);
  console.log(`  out:    ${OUT_DIR}`);
  console.log(`  headed: ${HEADED}`);
  console.log(`  delay:  ${DELAY_MS}ms`);
  console.log();

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext();
  const page = await context.newPage();

  const t0 = Date.now();
  const stats = { captured: 0, skipped: 0, failed: [] as { name: string; reason: string }[] };

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const tag = `[${i + 1}/${names.length}]`;
    const outPath = join(OUT_DIR, `${slugify(name)}.json`);

    if (existsSync(outPath)) {
      console.log(`${tag} ${name.padEnd(45)} skip (exists)`);
      stats.skipped++;
      continue;
    }

    try {
      const { ok, payload, reason } = await captureOne(page, name);
      if (!ok) {
        console.log(`${tag} ${name.padEnd(45)} FAILED: ${reason}`);
        stats.failed.push({ name, reason: reason ?? 'unknown' });
      } else {
        writeFileSync(outPath, JSON.stringify(payload), 'utf8');
        console.log(`${tag} ${name.padEnd(45)} saved → ${slugify(name)}.json`);
        stats.captured++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${tag} ${name.padEnd(45)} ERROR: ${msg}`);
      stats.failed.push({ name, reason: msg });
    }

    if (i < names.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  await browser.close();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(`Done in ${elapsed}s`);
  console.log(`  captured: ${stats.captured}`);
  console.log(`  skipped:  ${stats.skipped}`);
  console.log(`  failed:   ${stats.failed.length}`);
  if (stats.failed.length) {
    console.log('\nFailed cards:');
    for (const f of stats.failed.slice(0, 20)) console.log(`  - ${f.name}: ${f.reason}`);
    if (stats.failed.length > 20) console.log(`  ... and ${stats.failed.length - 20} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

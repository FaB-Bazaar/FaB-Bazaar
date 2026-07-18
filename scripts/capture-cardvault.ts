#!/usr/bin/env npx tsx
/**
 * scripts/capture-cardvault.ts — capture card payloads from CardVault.
 *
 * v2: pure API client (no browser). The SPA's backend lives at
 * api.cardvault.fabtcg.com; per input we call advanced-search/ to resolve the
 * card slug(s), then card_id/<slug>/ for the full payload — the SAME response
 * shape the legacy Playwright version intercepted, so capture files stay
 * byte-compatible with merge.py and import-i18n.ts.
 *
 * Improvements over the browser version:
 *   - --by-collector captures ALL cards sharing a collector number (double-
 *     sided promos like HER146 Kassai//Tuffnut; the browser clicked only the
 *     first tile), extras saved as <collector>--<slug>.json
 *   - no "no tiles on page" flakiness, ~10x faster
 *
 * Etiquette (mirrors import-new-set.ts): sequential, --delay ms + jitter,
 * identified UA, honors 429 Retry-After, aborts after 3 consecutive failures.
 *
 * Usage:
 *   npx tsx scripts/capture-cardvault.ts --input=/tmp/cards.txt                # names
 *   npx tsx scripts/capture-cardvault.ts --input=/tmp/cards.txt --by-collector # WTR087-style
 *   flags: --max=N --delay=1500 --out=/Users/eko/fabtcg/captures --refresh
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pickSlugs, captureFilename } from "@/lib/import/cardvault-capture";

const argv = process.argv.slice(2);
const arg = (name: string, dflt?: string) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : dflt;
};

const INPUT = arg("--input");
const BY_COLLECTOR = argv.includes("--by-collector");
const REFRESH = argv.includes("--refresh");
const MAX = arg("--max") ? parseInt(arg("--max")!, 10) : undefined;
const DELAY_MS = parseInt(arg("--delay", "1500")!, 10);
const OUT_DIR = arg("--out", "/Users/eko/fabtcg/captures")!;

if (!INPUT) {
  console.error("--input=<file> is required (one card name or collector per line)");
  process.exit(1);
}

const API = "https://api.cardvault.fabtcg.com/carddb/api/v1";
const UA = "FaBBazaar-Capture/2.0 (+https://fabbazaar.app)";

let consecutiveFailures = 0;

async function politeFetch(url: string): Promise<any> {
  const jitter = Math.floor(Math.random() * 400);
  await new Promise((r) => setTimeout(r, DELAY_MS + jitter));
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30", 10);
    console.log(`  429 — waiting ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return politeFetch(url);
  }
  if (!res.ok) {
    if (++consecutiveFailures >= 3) {
      console.error(`aborting: 3 consecutive failures (last: ${res.status} ${url})`);
      process.exit(1);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  consecutiveFailures = 0;
  return res.json();
}

(async () => {
  let lines = readFileSync(INPUT, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (MAX != null) lines = lines.slice(0, MAX);

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Will process ${lines.length} card(s)`);
  console.log(`  input:  ${INPUT}`);
  console.log(`  out:    ${OUT_DIR}`);
  console.log(`  mode:   ${BY_COLLECTOR ? "by-collector" : "by-name"} (API v2, no browser)`);
  console.log(`  delay:  ${DELAY_MS}ms\n`);

  let captured = 0, skipped = 0, failed = 0;
  const failures: Array<{ q: string; reason: string }> = [];
  const t0 = Date.now();

  for (let i = 0; i < lines.length; i++) {
    const q = lines[i];
    const tag = `[${i + 1}/${lines.length}]`;
    try {
      // Skip cheaply when the primary capture file already exists.
      const primary = join(OUT_DIR, captureFilename(q, BY_COLLECTOR, "", 0));
      if (!REFRESH && existsSync(primary)) {
        console.log(`${tag} ${q.padEnd(40)} skip (exists)`);
        skipped++;
        continue;
      }

      const search = await politeFetch(`${API}/advanced-search/?q=${encodeURIComponent(q)}`);
      const slugs = pickSlugs(q, BY_COLLECTOR, search.results ?? []);
      if (slugs.length === 0) {
        failed++;
        failures.push({ q, reason: "no search results" });
        console.log(`${tag} ${q.padEnd(40)} FAILED: no search results`);
        continue;
      }

      const saved: string[] = [];
      for (let s = 0; s < slugs.length; s++) {
        const payload = await politeFetch(`${API}/card_id/${slugs[s]}/`);
        const fname = captureFilename(q, BY_COLLECTOR, slugs[s], s);
        writeFileSync(join(OUT_DIR, fname), JSON.stringify(payload, null, 1));
        saved.push(fname);
      }
      captured++;
      console.log(`${tag} ${q.padEnd(40)} saved → ${saved.join(", ")}`);
    } catch (err) {
      failed++;
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ q, reason });
      console.log(`${tag} ${q.padEnd(40)} FAILED: ${reason}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  captured: ${captured}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  failed:   ${failed}`);
  if (failures.length > 0) {
    console.log(`\nFailed cards:`);
    for (const f of failures) console.log(`  - ${f.q}: ${f.reason}`);
  }
})();

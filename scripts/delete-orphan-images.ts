#!/usr/bin/env npx tsx
/**
 * Delete the redundant printing_id-keyed Cloudflare images left behind by the
 * deterministic-image-id migration (scripts/migrate-image-ids.ts).
 *
 * SAFETY MODEL — the Cloudflare account is SHARED with other apps, so this is
 * strictly allowlist-of-candidates, never an inventory diff:
 *   candidates = printing_ids whose own row's image_url no longer contains
 *                that printing_id (i.e. the row migrated off it)
 *   kept       = any id still present in ANY row's image_url (fallback rows),
 *                any 21-char id appearing in decks.metadata (matchup
 *                galleries construct printing_id URLs from saved JSON),
 *                any id hardcoded in lib/training/puzzles.ts
 * Only ids surviving that subtraction are deleted. By construction this can
 * never touch playmats, article images, avatars, or other apps' assets —
 * their ids are not printing_ids.
 *
 * KNOWN COST: card images embedded in old Discord posts / articles by URL go
 * dark. Recoverable per-image by re-copying from the deterministic twin.
 *
 * Cloudflare 5404 (already gone) counts as success → idempotent, resumable.
 *
 * Usage:
 *   npx tsx scripts/delete-orphan-images.ts               # dry run
 *   npx tsx scripts/delete-orphan-images.ts --live        # delete
 *   flags: --limit=N
 */
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { computeOrphanDeletions } from "@/lib/images/orphan-plan";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const LIVE = argv.includes("--live");
const LIMIT = argv.find((a) => a.startsWith("--limit="))?.split("=")[1];

// ~4 req/s — Cloudflare's global API limit is 1200 per 5 minutes.
const DELAY_MS = 250;

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");

  const candidates = (
    await pool.query<{ printing_id: string }>(
      `SELECT printing_id FROM printings
        WHERE image_url IS NOT NULL AND position(printing_id in image_url) = 0`,
    )
  ).rows.map((r) => r.printing_id);

  // Keep 1: every id segment referenced by any row's CURRENT image_url.
  const inUse = (
    await pool.query<{ id: string }>(
      `SELECT DISTINCT regexp_replace(image_url, '^.*/([^/]+)/[^/]+$', '\\1') AS id
         FROM printings WHERE image_url IS NOT NULL`,
    )
  ).rows.map((r) => r.id);

  // Keep 2: any 21-char id token inside decks.metadata (matchup galleries).
  const matchupIds = (
    await pool.query<{ id: string }>(
      `SELECT DISTINCT (regexp_matches(metadata::text, '[A-Za-z0-9_-]{21}', 'g'))[1] AS id
         FROM decks WHERE metadata IS NOT NULL`,
    )
  ).rows.map((r) => r.id);

  // Keep 3: ids hardcoded in the training puzzles.
  const puzzleSrc = readFileSync(join(process.cwd(), "lib/training/puzzles.ts"), "utf8");
  const puzzleIds = [...new Set(puzzleSrc.match(/"[A-Za-z0-9_-]{21}"/g) ?? [])].map((s) => s.slice(1, -1));

  let deletions = computeOrphanDeletions(candidates, [inUse, matchupIds, puzzleIds]);
  if (LIMIT) deletions = deletions.slice(0, parseInt(LIMIT, 10));

  console.log(`candidates: ${candidates.length}`);
  console.log(`kept — in use by a row: ${candidates.filter((c) => inUse.includes(c)).length}`);
  console.log(`kept — matchup metadata: ${candidates.filter((c) => matchupIds.includes(c)).length}`);
  console.log(`kept — puzzles: ${candidates.filter((c) => puzzleIds.includes(c)).length}`);
  console.log(`TO DELETE: ${deletions.length}${LIVE ? "" : "  (dry run — nothing deleted)"}`);

  if (!LIVE) {
    for (const d of deletions.slice(0, 10)) console.log(`  would delete: ${d}`);
    await pool.end();
    return;
  }

  let deleted = 0, gone = 0, failed = 0;
  const t0 = Date.now();
  for (let i = 0; i < deletions.length; i++) {
    const id = deletions[i];
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } },
      );
      const json = (await res.json()) as { success: boolean; errors: Array<{ code: number }> };
      if (json.success) deleted++;
      else if (json.errors?.some((e) => e.code === 5404)) gone++;
      else throw new Error(JSON.stringify(json.errors));
    } catch (err) {
      failed++;
      if (failed <= 20) console.log(`  FAILED ${id}: ${err instanceof Error ? err.message : err}`);
    }
    if ((i + 1) % 500 === 0 || i === deletions.length - 1) {
      const rate = ((i + 1) / ((Date.now() - t0) / 1000)).toFixed(1);
      const eta = ((deletions.length - i - 1) / Math.max(0.1, (i + 1) / ((Date.now() - t0) / 1000)) / 60).toFixed(0);
      console.log(`[${i + 1}/${deletions.length}] deleted=${deleted} already-gone=${gone} failed=${failed} (${rate}/s, ~${eta} min left)`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone: deleted=${deleted} already-gone=${gone} failed=${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * Backfill `cards` format-legality flags from the fab-cube feed, scoped to the
 * sets you name.
 *
 * A CardVault (spoiler-season) ingest creates card rows with every *_legal flag
 * false. Pipeline 005 adopts those rows once fab-cube publishes the set, but
 * legality lives in CARD_ADMIN_OWNED_COLS so ON CONFLICT never overwrites it —
 * the spoiler-era `false` is frozen and no nightly run will ever heal it. This
 * script does the one-time correction. See lib/import/legality-plan.ts.
 *
 * `--sets` is REQUIRED and has no "everything" mode on purpose: promo/prize
 * sets carry deliberate admin overrides (`win`, `her`, `sup` …) that a blanket
 * feed sync would wipe.
 *
 * Usage:
 *   npx tsx scripts/backfill-format-legality.ts --sets=mpw,aol           # dry run
 *   npx tsx scripts/backfill-format-legality.ts --sets=mpw,aol --live    # execute
 *   npx tsx scripts/backfill-format-legality.ts --sets=mpw --allow-revocations --live
 *
 * Required env (in .env.local): POSTGRES_URL.
 */
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import {
  planLegalityBackfill,
  LEGALITY_FLAGS,
  type DbCardRow,
  type FeedLegality,
  type LegalityFlags,
} from "@/lib/import/legality-plan";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
};
const LIVE = argv.includes("--live");
const ALLOW_REVOCATIONS = argv.includes("--allow-revocations");
const SETS = (arg("--sets") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const FEED_URL =
  "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/card.json";

async function fetchFeed(): Promise<FeedLegality[]> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`fab-cube feed fetch failed: ${res.status}`);
  return (await res.json()) as FeedLegality[];
}

async function main() {
  if (SETS.length === 0) {
    console.error("Missing --sets=<code[,code...]> (required; there is no all-sets mode)");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const { rows } = await pool.query(
    `SELECT c.card_unique_id, c.name, c.pitch, c.fab_cube_card_id,
            ${LEGALITY_FLAGS.map((f) => `c.${f}`).join(", ")}
       FROM cards c
      WHERE EXISTS (SELECT 1 FROM printings p
                     WHERE p.card_unique_id = c.card_unique_id AND p.set = ANY($1))
      ORDER BY c.name, c.pitch`,
    [SETS],
  );

  const dbRows: DbCardRow[] = rows.map((r) => ({
    cardUniqueId: r.card_unique_id,
    name: r.name,
    pitch: r.pitch,
    fabCubeCardId: r.fab_cube_card_id,
    flags: Object.fromEntries(LEGALITY_FLAGS.map((f) => [f, r[f] === true])) as LegalityFlags,
  }));

  console.log(`Sets: ${SETS.join(", ")} — ${dbRows.length} cards in DB`);
  const feed = await fetchFeed();
  console.log(`fab-cube feed: ${feed.length} cards`);

  const plan = planLegalityBackfill(dbRows, feed);

  console.log(
    `\nPlan: ${plan.updates.length} to update, ${plan.unchanged} already correct, ` +
      `${plan.unmatched.length} unmatched, ${plan.revocationCount} flag revocations`,
  );

  for (const u of plan.updates) {
    const changes = [
      ...u.grants.map((f) => `+${f}`),
      ...u.revocations.map((f) => `-${f}`),
    ].join(" ");
    console.log(`  ${u.name}${u.pitch ? ` (pitch ${u.pitch})` : ""}: ${changes}`);
  }
  for (const m of plan.unmatched) {
    console.log(`  ⚠ unmatched (${m.reason}): ${m.name}${m.pitch ? ` (pitch ${m.pitch})` : ""}`);
  }

  if (plan.revocationCount > 0 && !ALLOW_REVOCATIONS) {
    console.error(
      `\n✗ Plan removes ${plan.revocationCount} legality flag(s). That can undo a deliberate ` +
        `admin decision — re-run with --allow-revocations if the feed is right.`,
    );
    await pool.end();
    process.exit(1);
  }

  if (!LIVE) {
    console.log("\nDry run — nothing written. Re-run with --live to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of plan.updates) {
      await client.query(
        `UPDATE cards SET ${LEGALITY_FLAGS.map((f, i) => `${f} = $${i + 1}`).join(", ")},
                updated_at = NOW()
          WHERE card_unique_id = $${LEGALITY_FLAGS.length + 1}`,
        [...LEGALITY_FLAGS.map((f) => u.flags[f]), u.cardUniqueId],
      );
    }
    await client.query("COMMIT");
    console.log(`\n✓ Updated ${plan.updates.length} cards.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

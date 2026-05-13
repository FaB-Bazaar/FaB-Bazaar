#!/usr/bin/env npx tsx
/**
 * scripts/backfill-talishar-card-id.ts
 *
 * One-shot backfill for the `cards.talishar_card_id` column added by migration
 * 0050. Reads every row's (display_name, pitch), computes the Talishar id via
 * lib/talishar/cardId.ts, and writes it back.
 *
 * After this runs once, the pipeline (scripts 003 → 005) keeps the column in
 * sync on every weekly run, so this script should not need to be run again
 * unless the algorithm changes.
 *
 * Usage:
 *   npx tsx scripts/backfill-talishar-card-id.ts
 *   npx tsx scripts/backfill-talishar-card-id.ts --dry-run
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Pool } from "pg";
import { toTalisharCardId } from "../lib/talishar/cardId";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const { rows } = await pool.query<{
    card_unique_id: string;
    display_name: string;
    pitch: number | null;
    talishar_card_id: string | null;
  }>(
    `SELECT card_unique_id, display_name, pitch, talishar_card_id
     FROM cards
     ORDER BY card_unique_id`
  );

  console.log(`Loaded ${rows.length} cards.`);

  const updates: Array<{ id: string; value: string }> = [];
  for (const row of rows) {
    const computed = toTalisharCardId(row.display_name, row.pitch);
    if (row.talishar_card_id !== computed) {
      updates.push({ id: row.card_unique_id, value: computed });
    }
  }

  console.log(`${updates.length} rows need updating.`);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 20)) console.log(`  ${u.id} → ${u.value}`);
    if (updates.length > 20) console.log(`  ... ${updates.length - 20} more`);
    await pool.end();
    return;
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    // Single UPDATE ... FROM (VALUES ...) per batch.
    const params: unknown[] = [];
    const values = slice
      .map((u, idx) => {
        params.push(u.id, u.value);
        return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
      })
      .join(", ");
    await pool.query(
      `UPDATE cards AS c
       SET talishar_card_id = v.value
       FROM (VALUES ${values}) AS v(card_unique_id, value)
       WHERE c.card_unique_id = v.card_unique_id`,
      params
    );
    console.log(`  updated ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

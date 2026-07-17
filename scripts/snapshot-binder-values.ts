#!/usr/bin/env npx tsx
/**
 * scripts/snapshot-binder-values.ts
 *
 * Snapshot every binder's valuation (mirrors PostgresBinderService's
 * totalValue formula: SUM(quantity * tcg_market/low/mid/high)) plus row
 * counts and an order-independent checksum of the full inventory→printings
 * join. Used as a data-integrity invariant around migrations, pipeline
 * adoption runs, and printing merges: user-facing binder values must be
 * byte-identical before and after, because those operations must never touch
 * quantities, printing references, or prices.
 *
 * Usage:
 *   npx tsx scripts/snapshot-binder-values.ts --out=/tmp/before.json
 *   npx tsx scripts/snapshot-binder-values.ts --compare=/tmp/before.json
 *
 * Read-only. Requires POSTGRES_URL (.env.local).
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { Pool } from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (flag: string) => argv.find((a) => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=');
const OUT = arg('--out');
const COMPARE = arg('--compare');

interface Snapshot {
  binders: Array<{
    binderId: string;
    items: number;
    totalQty: number;
    valueMarket: string;
    valueLow: string;
    valueMid: string;
    valueHigh: string;
  }>;
  global: { binders: number; items: number; totalQty: number; valueMarket: string };
  checksum: string;
}

async function takeSnapshot(pool: Pool): Promise<Snapshot> {
  const per = await pool.query(`
    SELECT ii.binder_id,
           COUNT(*)::int AS items,
           SUM(ii.quantity)::int AS total_qty,
           COALESCE(SUM(ii.quantity * p.tcg_market), 0)::numeric(14,2)::text AS value_market,
           COALESCE(SUM(ii.quantity * p.tcg_low), 0)::numeric(14,2)::text AS value_low,
           COALESCE(SUM(ii.quantity * p.tcg_mid), 0)::numeric(14,2)::text AS value_mid,
           COALESCE(SUM(ii.quantity * p.tcg_high), 0)::numeric(14,2)::text AS value_high
      FROM inventory_items ii
      JOIN printings p ON p.printing_id = ii.printing_id
     GROUP BY ii.binder_id
     ORDER BY ii.binder_id`);
  // Order-independent checksum over the full join — catches ANY drift in
  // quantities, printing references, conditions, or the four price columns,
  // even drift that cancels out in the per-binder sums.
  const sum = await pool.query(`
    SELECT md5(string_agg(row_txt, '|' ORDER BY row_txt)) AS checksum
      FROM (
        SELECT concat_ws(',', ii.binder_id, ii.printing_id, ii.condition, ii.language,
                         ii.quantity, p.tcg_market, p.tcg_low, p.tcg_mid, p.tcg_high) AS row_txt
          FROM inventory_items ii
          JOIN printings p ON p.printing_id = ii.printing_id
      ) x`);
  const binders = per.rows.map((r) => ({
    binderId: r.binder_id,
    items: r.items,
    totalQty: r.total_qty,
    valueMarket: r.value_market,
    valueLow: r.value_low,
    valueMid: r.value_mid,
    valueHigh: r.value_high,
  }));
  const global = {
    binders: binders.length,
    items: binders.reduce((a, b) => a + b.items, 0),
    totalQty: binders.reduce((a, b) => a + b.totalQty, 0),
    valueMarket: binders.reduce((a, b) => a + Number(b.valueMarket), 0).toFixed(2),
  };
  return { binders, global, checksum: sum.rows[0].checksum };
}

(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const snap = await takeSnapshot(pool);
  await pool.end();

  console.log(`binders: ${snap.global.binders} | items: ${snap.global.items} | total qty: ${snap.global.totalQty} | market value: $${snap.global.valueMarket}`);
  console.log(`checksum: ${snap.checksum}`);

  if (OUT) {
    writeFileSync(OUT, JSON.stringify(snap, null, 1));
    console.log(`snapshot written to ${OUT}`);
  }
  if (COMPARE) {
    const before: Snapshot = JSON.parse(readFileSync(COMPARE, 'utf8'));
    const diffs: string[] = [];
    if (before.checksum !== snap.checksum) diffs.push(`checksum: ${before.checksum} → ${snap.checksum}`);
    const byId = new Map(snap.binders.map((b) => [b.binderId, b]));
    for (const b of before.binders) {
      const now = byId.get(b.binderId);
      if (!now) { diffs.push(`binder ${b.binderId}: MISSING after`); continue; }
      for (const k of ['items', 'totalQty', 'valueMarket', 'valueLow', 'valueMid', 'valueHigh'] as const) {
        if (String(now[k]) !== String(b[k])) diffs.push(`binder ${b.binderId}.${k}: ${b[k]} → ${now[k]}`);
      }
    }
    for (const b of snap.binders) if (!before.binders.some((x) => x.binderId === b.binderId)) diffs.push(`binder ${b.binderId}: NEW after`);
    if (diffs.length) {
      console.error(`\n✗ DRIFT DETECTED (${diffs.length}):`);
      diffs.slice(0, 20).forEach((d) => console.error('  ', d));
      process.exit(1);
    }
    console.log(`✓ IDENTICAL to ${COMPARE} — every binder's value, quantities, and the full-join checksum match.`);
  }
})();

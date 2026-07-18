#!/usr/bin/env npx tsx
/**
 * scripts/backfill-face-links.ts
 *
 * One-time-ish backfill: link the legacy double-sided face pairs the pipeline
 * created UNLINKED (fab-cube only populates other_face_printing_id for some
 * DFCs — Figments, marvel art-backs, invocation variants etc. shipped as two
 * sibling rows with no link and is_front_face=true on both).
 *
 * Classification: fab-cube's own image filenames (X.webp vs X_BACK.webp,
 * _Back, _A_Back) — see lib/import/face-backfill.ts. Ambiguity is reported,
 * never guessed.
 *
 * Writes exactly two metadata columns on matched pairs:
 *   back:  is_front_face=false, other_face_printing_id=<front>
 *   front: other_face_printing_id=<back>
 * Never touches rows that already carry a link. No deletes, no repointing —
 * inventory/wants/decks and all prices are untouched by construction (gate
 * with scripts/snapshot-binder-values.ts around the run regardless).
 *
 * Usage:
 *   npx tsx scripts/backfill-face-links.ts                 # dry-run
 *   npx tsx scripts/backfill-face-links.ts --commit
 *   flags: --feed-file=/path/card.json   (default: fetch fab-cube develop)
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { pairBackFaces, type FaceEntry } from '@/lib/import/face-backfill';

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const FEED_FILE = argv.find((a) => a.startsWith('--feed-file='))?.split('=')[1];
const FEED_URL = 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/card.json';

(async () => {
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — legacy double-sided face-link backfill`);

  // 1. fab-cube feed → (uid, image) entries
  let feed: any[];
  if (FEED_FILE) {
    feed = JSON.parse(readFileSync(FEED_FILE, 'utf8'));
  } else {
    console.log('fetching fab-cube develop card.json (~20 MB, 1 request)…');
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)' } });
    if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
    feed = await res.json();
  }
  const entries: FaceEntry[] = [];
  for (const card of feed) {
    for (const p of card.printings ?? []) {
      if (p.unique_id && p.image_url) {
        entries.push({
          uid: p.unique_id,
          image: p.image_url,
          // Disambiguates same-image foiling variants; face siblings share
          // all four attributes.
          key: `${p.set_id ?? ''}|${p.id ?? ''}|${p.edition ?? ''}|${p.foiling ?? ''}`.toLowerCase(),
        });
      }
    }
  }
  const { pairs, orphans, ambiguous } = pairBackFaces(entries);
  console.log(`feed: ${entries.length} printings → ${pairs.length} face pairs, ${orphans.length} orphan backs, ${ambiguous.length} ambiguous`);

  // 2. resolve fab-cube uids to internal rows via the anchor column (adopted
  //    rows have internal ids != fab-cube ids)
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const uids = [...new Set(pairs.flatMap((p) => [p.frontUid, p.backUid]))];
  const rows = await pool.query(
    `SELECT printing_id, fab_cube_printing_id, other_face_printing_id, is_front_face, set
       FROM printings WHERE fab_cube_printing_id = ANY($1)`, [uids]);
  const byUid = new Map(rows.rows.map((r) => [r.fab_cube_printing_id, r]));

  const plan: Array<{ frontId: string; backId: string; set: string }> = [];
  let alreadyLinked = 0, notInDb = 0, conflicting = 0;
  for (const p of pairs) {
    const front = byUid.get(p.frontUid);
    const back = byUid.get(p.backUid);
    if (!front || !back) { notInDb++; continue; }
    if (front.other_face_printing_id === back.printing_id && back.other_face_printing_id === front.printing_id) {
      alreadyLinked++; continue;
    }
    if (front.other_face_printing_id || back.other_face_printing_id) {
      // linked to something else — report, never overwrite
      conflicting++;
      console.warn(`   ⚠ conflicting existing link for pair ${p.frontUid} / ${p.backUid} — skipped`);
      continue;
    }
    plan.push({ frontId: front.printing_id, backId: back.printing_id, set: front.set });
  }

  const bySet = new Map<string, number>();
  for (const p of plan) bySet.set(p.set, (bySet.get(p.set) ?? 0) + 1);
  console.log(`\nplan: link ${plan.length} pairs (${alreadyLinked} already linked, ${notInDb} not in DB, ${conflicting} conflicting)`);
  for (const [set, n] of [...bySet.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${set}: ${n} pairs`);

  // transparency: how much user data sits on the rows being flagged as backs
  const backIds = plan.map((p) => p.backId);
  if (backIds.length) {
    const owned = await pool.query(
      `SELECT COUNT(*)::int AS items, COUNT(DISTINCT user_id)::int AS users
         FROM inventory_items WHERE printing_id = ANY($1)`, [backIds]);
    console.log(`affected owned rows: ${owned.rows[0].items} inventory items across ${owned.rows[0].users} users (metadata-only change — nothing moves)`);
  }

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of plan) {
      await client.query(
        `UPDATE printings SET is_front_face = false, other_face_printing_id = $2
          WHERE printing_id = $1 AND other_face_printing_id IS NULL`, [p.backId, p.frontId]);
      await client.query(
        `UPDATE printings SET is_front_face = true, other_face_printing_id = $2
          WHERE printing_id = $1 AND other_face_printing_id IS NULL`, [p.frontId, p.backId]);
    }
    await client.query('COMMIT');
    console.log(`✓ linked ${plan.length} pairs`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
})();

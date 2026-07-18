#!/usr/bin/env npx tsx
/**
 * Migrate Cloudflare image ids from printing_id nanoids to deterministic
 * LSS-style keys (lib/images/deterministic-image-id.ts), so every environment
 * computes identical image URLs and shares one uploaded image per printing.
 *
 * For each planned row: CF→CF copy (upload the row's CURRENT imagedelivery
 * URL under the new custom id — no re-fetch from LSS S3), treat Cloudflare
 * 5409 "already exists" as success (idempotent/resumable), and only then flip
 * printings.image_url. Old images are NEVER deleted — anything that cached a
 * nanoid URL (Discord embeds, articles) keeps working, and rows whose key
 * collides (alt-art tail) or can't be derived keep their nanoid image
 * forever.
 *
 * Usage:
 *   npx tsx scripts/migrate-image-ids.ts                  # dry run, whole DB
 *   npx tsx scripts/migrate-image-ids.ts --set=iar        # dry run, one set
 *   npx tsx scripts/migrate-image-ids.ts --set=iar --live # execute
 *   npx tsx scripts/migrate-image-ids.ts --live           # execute everything
 *
 * Required env (in .env.local): POSTGRES_URL, CLOUDFLARE_ACCOUNT_ID,
 * CLOUDFLARE_API_TOKEN.
 */
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { planImageIdMigration, type MigratableRow } from "@/lib/images/migrate-plan";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
};
const LIVE = argv.includes("--live");
const SET = arg("--set")?.toLowerCase();
const LIMIT = arg("--limit") ? parseInt(arg("--limit")!, 10) : undefined;

// ~4 req/s keeps us inside Cloudflare's global API rate limit (1200/5min).
const DELAY_MS = 250;

async function uploadCopy(sourceUrl: string, imageId: string): Promise<"uploaded" | "exists"> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");

  // Cloudflare refuses URL-ingest from imagedelivery.net itself (error 5454),
  // so fetch the bytes and re-upload them as a file.
  const src = await fetch(sourceUrl);
  if (!src.ok) throw new Error(`source fetch ${src.status} for ${sourceUrl}`);
  const blob = await src.blob();

  const form = new FormData();
  form.append("file", blob, imageId);
  form.append("id", imageId);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: form },
  );
  const json = (await res.json()) as { success: boolean; errors: Array<{ code: number; message: string }> };
  if (json.success) return "uploaded";
  if (json.errors?.some((e) => e.code === 5409 || /already exists/i.test(e.message))) return "exists";
  throw new Error(`Cloudflare upload failed for ${imageId}: ${JSON.stringify(json.errors)}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const { rows } = await pool.query<MigratableRow>(
    `SELECT printing_id, language, collector_number, foiling, edition,
            is_extended_art, is_front_face, art_variations, set, image_url
       FROM printings`,
  );
  console.log(`Loaded ${rows.length} printings${SET ? ` (planning scope: set=${SET})` : ""}`);

  const plan = planImageIdMigration(rows, { set: SET });
  const uploads = LIMIT ? plan.uploads.slice(0, LIMIT) : plan.uploads;

  console.log(`Plan: ${plan.uploads.length} to migrate${LIMIT ? ` (limited to ${uploads.length})` : ""}, ` +
    `${plan.done.length} already done, ${plan.fallbacks.length} keep printing_id (fallback)`);
  const reasons = new Map<string, number>();
  for (const f of plan.fallbacks) {
    const r = f.reason.replace(/:.*/, "");
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  for (const [r, n] of reasons) console.log(`  fallback — ${r}: ${n}`);

  if (!LIVE) {
    console.log("\nDry run — no uploads, no DB writes. Sample of planned migrations:");
    for (const u of uploads.slice(0, 10)) console.log(`  ${u.printing_id} → ${u.new_image_id}`);
    await pool.end();
    return;
  }

  let migrated = 0, existed = 0, failed = 0;
  const failures: Array<{ printing_id: string; err: string }> = [];
  const t0 = Date.now();

  // Batches of BATCH concurrent uploads, one batch per ~BATCH*DELAY_MS —
  // aggregate ≤4 req/s, inside Cloudflare's 1200-per-5-min API cap.
  const BATCH = 4;
  for (let i = 0; i < uploads.length; i += BATCH) {
    const batch = uploads.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (u) => {
        try {
          const outcome = await uploadCopy(u.source_url, u.new_image_id);
          await pool.query(
            `UPDATE printings SET image_url = $1, has_cloudflare_image = true WHERE printing_id = $2`,
            [u.new_image_url, u.printing_id],
          );
          outcome === "uploaded" ? migrated++ : existed++;
        } catch (err) {
          failed++;
          failures.push({ printing_id: u.printing_id, err: err instanceof Error ? err.message : String(err) });
        }
      }),
    );
    const done = Math.min(i + BATCH, uploads.length);
    if (done % 200 < BATCH || done === uploads.length) {
      const rate = (done / ((Date.now() - t0) / 1000)).toFixed(1);
      const eta = ((uploads.length - done) / Math.max(0.1, done / ((Date.now() - t0) / 1000)) / 60).toFixed(0);
      console.log(`[${done}/${uploads.length}] migrated=${migrated} existed=${existed} failed=${failed} (${rate}/s, ~${eta} min left)`);
    }
    await new Promise((r) => setTimeout(r, BATCH * DELAY_MS));
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Done in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
  console.log(`  uploaded fresh:      ${migrated}`);
  console.log(`  already existed:     ${existed}`);
  console.log(`  failed:              ${failed}`);
  console.log(`  fallback (skipped):  ${plan.fallbacks.length}`);
  if (failures.length > 0) {
    console.log(`\nFailures (re-run to retry — idempotent):`);
    for (const f of failures.slice(0, 20)) console.log(`  ${f.printing_id}: ${f.err}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * Replace Cloudflare card images from the fab-cube FEED's per-printing
 * image_url — an exact per-printing source (fabmaster originals, often
 * 1488×2079), used where key-derived CardVault sourcing is ambiguous or was
 * wrong: contested marvel front/back pairs, alt-art (V2) variants, nanoid
 * fallback keys, and the 2026-08-08 contested-upload correction.
 *
 * Matching, per image key:
 *   1. anchor: printings.fab_cube_printing_id == feed printing.unique_id
 *   2. fallback: (collector_number, foiling, art_variations) exact match
 * Every DB row sharing the key must agree on ONE feed image_url, and no two
 * keys may claim the same source file — otherwise the key is skipped.
 *
 * Usage:
 *   npx tsx scripts/upgrade-images-from-feed.ts --set=upr --keys=<file>          # dry run
 *   npx tsx scripts/upgrade-images-from-feed.ts --set=upr --keys=<file> --live
 *
 * --keys: file with one Cloudflare image key per line (the 5th URL segment).
 * Sources smaller than 546px are still uploaded when they are the designated
 * art (correctness beats resolution) but logged with a warning.
 */
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "fs";
import { Pool } from "pg";
import { imageWidth } from "@/lib/images/image-dimensions";
import { resolveFeedClaims } from "@/lib/images/upgrade-plan";

loadEnvConfig(process.cwd());
const argv = process.argv.slice(2);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
};
const LIVE = argv.includes("--live");
const SET = arg("--set")?.toLowerCase();
const KEYS_FILE = arg("--keys");
const FEED_PATH = arg("--feed") ?? "pipeline/scripts/cards.enhanced.json";
if (!SET || !KEYS_FILE) {
  console.error("usage: upgrade-images-from-feed.ts --set=<code> --keys=<file> [--live]");
  process.exit(1);
}

const UA = { "User-Agent": "Mozilla/5.0 (fabbazaar image-upgrade)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const token = process.env.CLOUDFLARE_API_TOKEN ?? "";

async function cfDelete(id: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await res.json()) as { success: boolean; errors: Array<{ code: number; message: string }> };
  if (!json.success && !json.errors?.some((e) => e.code === 5404 || /not found/i.test(e.message))) {
    throw new Error(`delete ${id}: ${JSON.stringify(json.errors)}`);
  }
}

async function cfUpload(id: string, bytes: Uint8Array) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const form = new FormData();
    form.append("file", new Blob([bytes as BufferSource]), id);
    form.append("id", id);
    // The upload runs AFTER the delete, so a bare network throw here would
    // abandon the id deleted — a live 404 (how MST100/MST101 broke). Catch
    // transport errors into the retry loop instead of propagating.
    let json: { success: boolean; errors: Array<{ code: number; message: string }> };
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      json = (await res.json()) as typeof json;
    } catch (err) {
      if (attempt === 6) throw new Error(`upload ${id}: transport failed 6× — ${String(err)}`);
      await sleep(1500 * attempt);
      continue;
    }
    if (json.success) return;
    if (json.errors?.some((e) => e.code === 5409 || /already exists/i.test(e.message))) {
      await sleep(1500 * attempt);
      await cfDelete(id);
      await sleep(1500 * attempt);
      continue;
    }
    throw new Error(`upload ${id}: ${JSON.stringify(json.errors)}`);
  }
  throw new Error(`upload ${id}: id never freed`);
}

const setEq = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

async function main() {
  const keys = readFileSync(KEYS_FILE!, "utf8").trim().split("\n").filter(Boolean);
  if (LIVE && (!accountId || !token)) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const { rows } = await pool.query<{
    image_url: string; fab_cube_printing_id: string | null;
    collector_number: string; foiling: string; art_variations: string[];
    edition: string; is_front_face: boolean;
  }>(
    `SELECT image_url, fab_cube_printing_id, collector_number, foiling, art_variations,
            edition, is_front_face
       FROM printings WHERE set = $1 AND language = 'en'
        AND split_part(image_url, '/', 5) = ANY($2)`,
    [SET, keys],
  );
  await pool.end();

  const feed = JSON.parse(readFileSync(FEED_PATH, "utf8"));
  const cards: any[] = Array.isArray(feed) ? feed : feed.cards;
  const byAnchor = new Map<string, string>();
  const byAttrs: Array<{ cn: string; foiling: string; av: string[]; url: string }> = [];
  for (const c of cards) {
    for (const p of c.printings ?? []) {
      if (!p.image_url) continue;
      if (p.unique_id) byAnchor.set(p.unique_id, p.image_url);
      byAttrs.push({ cn: p.id, foiling: String(p.foiling).toLowerCase(), av: p.art_variations ?? [], url: p.image_url });
    }
  }

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.image_url.split("/")[4];
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  const plan: Array<{ key: string; source: string; via: string }> = [];
  const skipped: string[] = [];
  for (const key of keys) {
    const keyRows = byKey.get(key);
    if (!keyRows) { skipped.push(`${key} (no DB rows in ${SET}/en)`); continue; }
    const sources = new Map<string, string>(); // url -> via
    for (const r of keyRows) {
      const anchored = r.fab_cube_printing_id ? byAnchor.get(r.fab_cube_printing_id) : undefined;
      if (anchored) { sources.set(anchored, "anchor"); continue; }
      const matches = byAttrs.filter(
        (f) => f.cn === r.collector_number && f.foiling === r.foiling && setEq(f.av, r.art_variations ?? []),
      );
      for (const m of matches) if (!sources.has(m.url)) sources.set(m.url, "attrs");
    }
    if (sources.size === 1) {
      const [url, via] = [...sources.entries()][0];
      plan.push({ key, source: url, via });
    } else {
      skipped.push(`${key} (${sources.size} candidate sources)`);
    }
  }

  // Several keys may legitimately share a feed image (the feed reuses one file
  // across finishes of the same printing). Only a share across editions / art
  // variants / faces is a real conflict — see resolveFeedClaims.
  const { accepted, rejected } = resolveFeedClaims(
    plan.map((p) => ({
      key: p.key,
      source: p.source,
      rows: (byKey.get(p.key) ?? []).map((r) => ({
        collector: r.collector_number,
        edition: r.edition,
        artVariations: r.art_variations ?? [],
        isFrontFace: r.is_front_face,
      })),
    })),
  );
  const acceptedKeys = new Set(accepted.map((c) => c.key));
  const finalPlan = plan.filter((p) => acceptedKeys.has(p.key));
  for (const r of rejected) skipped.push(`${r.key} (source contested: ${r.source.split("/").pop()})`);

  console.log(`target keys: ${keys.length}, mapped: ${finalPlan.length}, skipped: ${skipped.length}`);
  for (const s of skipped) console.log(`  skip: ${s}`);
  for (const p of finalPlan) console.log(`  ${p.key} <- ${p.source.split("/").pop()} [${p.via}]`);
  if (!LIVE) { console.log("\nDry run — no writes."); return; }

  let ok = 0, failed = 0;
  for (const p of finalPlan) {
    try {
      const src = await fetch(p.source, { headers: UA });
      if (!src.ok) throw new Error(`source ${src.status}`);
      const buf = new Uint8Array(await src.arrayBuffer());
      const w = imageWidth(buf);
      if (!w || w < 280) throw new Error(`source unreadable/too small (${w}px)`);
      if (w < 546) console.warn(`  WARN ${p.key}: source only ${w}px — uploading anyway (designated art)`);
      await cfDelete(p.key);
      await cfUpload(p.key, buf);
      ok++;
      console.log(`  upgraded ${p.key} (${w}px source)`);
    } catch (err) {
      failed++;
      console.error(`  CRITICAL ${p.key}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(400);
  }
  console.log(`done: upgraded=${ok} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

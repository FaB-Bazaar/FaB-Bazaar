// scripts/upload-hero-crops.ts
// One-off uploader for cropped hero portraits → Cloudflare Images.
// Reads webp files from a local folder (default: ~/talishar-fe/hero-crops),
// strips the `_cropped` suffix, normalizes a couple of known spelling drifts,
// and uploads each as a Cloudflare Image with a custom ID equal to the canonical
// talisharId. The resulting URL pattern is:
//   https://imagedelivery.net/<account-hash>/<talisharId>/public
//
// Usage:
//   npx tsx scripts/upload-hero-crops.ts [--dry-run] [--src <folder>] [--overwrite]
//
// Reads CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_TOKEN (or CLOUDFLARE_API_TOKEN)
// from .env.local automatically — no need to inline them. The token needs the
// `Account → Cloudflare Images → Edit` permission.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Agent } from 'undici';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes-rosters';
import { toTalisharIdentifier } from '@/lib/utils';

// Cloudflare's edge frequently closes idle/keep-alive sockets. Undici's default
// pool will then reuse a half-closed socket and surface "other side closed".
// Force a fresh connection per request by disabling keep-alive entirely.
const NO_KEEP_ALIVE = new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1 });
const PER_REQUEST_DELAY_MS = 150;

const DEFAULT_SRC = path.join(process.env.HOME || '', 'talishar-fe/hero-crops');

// Known filename → canonical talisharId fixups. Add to this map if a file's
// stem doesn't match the roster's talisharId (typically transliteration drift).
const NAME_FIXUPS: Record<string, string> = {
  jarl_vetreidi: 'jarl_vetreii',
};

interface CliArgs {
  src: string;
  dryRun: boolean;
  overwrite: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { src: DEFAULT_SRC, dryRun: false, overwrite: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') out.dryRun = true;
    else if (args[i] === '--overwrite') out.overwrite = true;
    else if (args[i] === '--src' && args[i + 1]) {
      out.src = args[++i];
    }
  }
  return out;
}

async function uploadOne(
  filePath: string,
  imageId: string,
  accountId: string,
  token: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const buf = await readFile(filePath);
  // Cloudflare's edge occasionally drops sockets mid-POST. Retry transient
  // network errors a few times before giving up so a flaky upload doesn't
  // abort the whole batch.
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const form = new FormData();
    form.append('id', imageId);
    form.append('file', new Blob([buf], { type: 'image/webp' }), `${imageId}.webp`);
    form.append('requireSignedURLs', 'false');
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          // @ts-expect-error — undici dispatcher is supported at runtime in Node 18+
          dispatcher: NO_KEEP_ALIVE,
        },
      );
      const body = await res.text();
      return { ok: res.ok, status: res.status, body };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
    }
  }
  return { ok: false, status: 0, body: `network error: ${String(lastErr)}` };
}

async function deleteImage(
  imageId: string,
  accountId: string,
  token: string,
): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
}

async function main() {
  const args = parseArgs();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_IMAGES_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!args.dryRun && (!accountId || !token)) {
    console.error('Missing CLOUDFLARE_ACCOUNT_ID and/or CLOUDFLARE_IMAGES_TOKEN.');
    process.exit(1);
  }

  const rosterIds = new Set<string>([
    ...Object.keys(HERO_INFO).map(toTalisharIdentifier),
    ...Object.keys(YOUNG_HERO_INFO).map(toTalisharIdentifier),
  ]);

  const entries = (await readdir(args.src)).filter((f) => f.endsWith('_cropped.webp'));
  console.log(`Found ${entries.length} crop files in ${args.src}`);

  const planned: Array<{ file: string; imageId: string; inRoster: boolean }> = [];
  for (const file of entries) {
    const stem = file.replace(/_cropped\.webp$/, '');
    const imageId = NAME_FIXUPS[stem] ?? stem;
    planned.push({ file, imageId, inRoster: rosterIds.has(imageId) });
  }

  const inRoster = planned.filter((p) => p.inRoster);
  const extras = planned.filter((p) => !p.inRoster);
  console.log(`In roster: ${inRoster.length}   Extras (uploaded too): ${extras.length}`);
  if (extras.length) {
    console.log('  extras:', extras.map((e) => e.imageId).join(', '));
  }

  if (args.dryRun) {
    console.log('\n--dry-run: would upload these IDs:');
    for (const p of planned) console.log(`  ${p.imageId}  ←  ${p.file}`);
    return;
  }

  let ok = 0;
  let already = 0;
  let failed = 0;
  for (const p of planned) {
    const filePath = path.join(args.src, p.file);
    let result = await uploadOne(filePath, p.imageId, accountId!, token!);
    await new Promise((r) => setTimeout(r, PER_REQUEST_DELAY_MS));
    // Cloudflare returns 409 (or success:false with code 5409) if ID exists.
    const isConflict = !result.ok && (result.status === 409 || /already exists|5409/i.test(result.body));
    if (isConflict && args.overwrite) {
      await deleteImage(p.imageId, accountId!, token!);
      result = await uploadOne(filePath, p.imageId, accountId!, token!);
    } else if (isConflict) {
      already++;
      process.stdout.write(`= ${p.imageId} (exists, skipped — use --overwrite to replace)\n`);
      continue;
    }

    if (result.ok) {
      ok++;
      process.stdout.write(`✓ ${p.imageId}\n`);
    } else {
      failed++;
      process.stdout.write(`✗ ${p.imageId}  HTTP ${result.status}  ${result.body.slice(0, 200)}\n`);
    }
  }

  console.log(`\nDone. uploaded=${ok}  already-existed=${already}  failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

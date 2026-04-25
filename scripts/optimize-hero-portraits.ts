// scripts/optimize-hero-portraits.ts
// Generate .webp variants of every hero portrait PNG under public/heroes/.
// Run with: npx tsx scripts/optimize-hero-portraits.ts
// WebP is ~70-80% smaller than PNG for these portraits and has universal browser support.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function main() {
  const dir = path.resolve(process.cwd(), 'public/heroes');
  const entries = await readdir(dir);
  const pngs = entries.filter((f) => f.endsWith('.png'));

  let totalSrc = 0;
  let totalOut = 0;
  let written = 0;
  let skipped = 0;

  for (const file of pngs) {
    const src = path.join(dir, file);
    const out = src.replace(/\.png$/i, '.webp');
    const srcStat = await stat(src);

    let outFresh = false;
    try {
      const outStat = await stat(out);
      outFresh = outStat.mtimeMs >= srcStat.mtimeMs;
    } catch {
      outFresh = false;
    }

    if (outFresh) {
      const outStat = await stat(out);
      totalSrc += srcStat.size;
      totalOut += outStat.size;
      skipped++;
      continue;
    }

    await sharp(src).webp({ quality: 82, effort: 5 }).toFile(out);
    const outStat = await stat(out);
    totalSrc += srcStat.size;
    totalOut += outStat.size;
    written++;
    console.log(
      `${file} → ${path.basename(out)}  ${(srcStat.size / 1024).toFixed(0)}KB → ${(outStat.size / 1024).toFixed(0)}KB`
    );
  }

  const pct = totalSrc > 0 ? Math.round(((totalSrc - totalOut) / totalSrc) * 100) : 0;
  console.log(`\nWrote ${written}, skipped ${skipped}.`);
  console.log(
    `Total: ${(totalSrc / 1024 / 1024).toFixed(2)}MB → ${(totalOut / 1024 / 1024).toFixed(2)}MB (${pct}% saved)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

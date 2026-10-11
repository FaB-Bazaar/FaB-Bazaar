// scripts/scan-banner-check.ts — run the banner scanner (lib/scan/banner) end to end on real photos: real tesseract.js +
// the real name index from the DB in .env.local.
//   npx tsx scripts/scan-banner-check.ts <photo> [photo ...]   accepted cards + timings per photo
//   npx tsx scripts/scan-banner-check.ts --score [--corpus=<dir>] [--only=<file>]
//       every labelled photo in the corpus: right / WRONG / missed against the answer keys (binder labels.json +
//       <photo>.labels.json for loose layouts). WRONG must stay 0 — a confident wrong card is the failure that matters.
//       --why shows the OCR text behind each extra card
//   TESS_CACHE=<dir> keeps the OCR model out of the repo root.
import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd());
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { buildNameIndex, normalizeName, type NameIndex } from '@/lib/scan/banner/name-match';
import { scanPhoto, type ScanResult } from '@/lib/scan/banner/scan-photo';

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find(a => a.startsWith(`${n}=`))?.slice(n.length + 1);
const CORPUS = arg('--corpus') ?? path.join(os.homedir(), 'Documents', 'FaB-Bazaar-Notes', 'scan-corpus', 'binder');

interface Truth { file: string; names: string[]; unknown: number }

/** Answer keys: binder pages (labels.json; empty pockets skipped, unnamed ones counted as `unknown`) + loose layouts. */
function answerKeys(): Truth[] {
  const out: Truth[] = [];
  for (const p of JSON.parse(fs.readFileSync(path.join(CORPUS, 'labels.json'), 'utf8')) as Array<{ file: string; cards: Array<{ name: string | null; empty?: boolean; unknown?: boolean }> }>) {
    if (p.file === 'page-01-whatsapp.jpg') continue;
    out.push({ file: p.file, names: p.cards.filter(c => !c.empty && !c.unknown && c.name).map(c => c.name!), unknown: p.cards.filter(c => c.unknown).length });
  }
  for (const f of fs.readdirSync(CORPUS).filter(f => f.endsWith('.labels.json'))) {
    const k = JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')) as { file: string; cards: Record<string, number> };
    out.push({ file: k.file, names: Object.entries(k.cards).flatMap(([n, c]) => Array(c).fill(n)), unknown: 0 });
  }
  return out;
}

async function run(index: NameIndex, ocr: (img: any) => Promise<string>, file: string): Promise<{ out: ScanResult; ms: number; size: string }> {
  const { data, info } = await sharp(file).rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t0 = Date.now();
  const out = await scanPhoto({ data, width: info.width, height: info.height, channels: 3 }, index, ocr);
  return { out, ms: Date.now() - t0, size: `${info.width}x${info.height}` };
}

(async () => {
  // imported lazily: static imports run before loadEnvConfig, and the DB module needs POSTGRES_URL at load
  const { PostgresPrintingsService } = await import('@/lib/services/postgres/printings/PostgresPrintingsService');
  const res = await new PostgresPrintingsService().getScanNameIndex(); if (!res.success) throw new Error(res.error);
  const index = buildNameIndex(res.data);
  const worker = await createWorker('eng', 1, { cachePath: process.env.TESS_CACHE ?? os.tmpdir() }); await worker.setParameters({ tessedit_pageseg_mode: '7' as any });
  const ocr = async (img: any) => (await worker.recognize(await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } }).png().toBuffer())).data.text;

  if (argv.includes('--score')) {
    const only = arg('--only'); const tot = { right: 0, wrong: 0, missed: 0, unverified: 0, cards: 0, ms: 0 };
    for (const t of answerKeys().filter(t => !only || t.file === only)) {
      const { out, ms } = await run(index, ocr, path.join(CORPUS, t.file));
      const left = new Map<string, number>(); for (const n of t.names) left.set(normalizeName(n), (left.get(normalizeName(n)) ?? 0) + 1);
      let right = 0; const extra: string[] = [];
      for (const c of out.cards.filter(c => c.accepted)) {
        const k = normalizeName(c.card), n = left.get(k) ?? 0;
        if (n > 0) { left.set(k, n - 1); right++; } else extra.push(argv.includes('--why') ? `${c.card} <- ${JSON.stringify(c.text.trim())} (${c.score.toFixed(2)})` : c.card);
      }
      const unverified = Math.min(extra.length, t.unknown);   // could be one of the pockets nobody has named yet
      const wrong = extra.slice(unverified);
      tot.right += right; tot.wrong += wrong.length; tot.missed += t.names.length - right; tot.unverified += unverified; tot.cards += t.names.length; tot.ms += ms;
      console.log(`${t.file.padEnd(44)} right ${String(right).padStart(2)}/${String(t.names.length).padEnd(2)} ${wrong.length ? `WRONG ${wrong.join(', ')}` : ''}${unverified ? ` (unverified: ${extra.slice(0, unverified).join(', ')})` : ''}  ${ms} ms`);
    }
    console.log(`\nTOTAL right ${tot.right}/${tot.cards}  WRONG ${tot.wrong}  missed ${tot.missed}  unverified ${tot.unverified}  (${(tot.ms / 1000).toFixed(0)} s)`);
  } else {
    for (const f of argv.filter(a => !a.startsWith('--'))) {
      const { out, ms, size } = await run(index, ocr, f);
      const acc = out.cards.filter(c => c.accepted), tm = out.timings;
      console.log(`\n${f.split('/').pop()} ${size}: ${acc.length} accepted in ${ms} ms  (find ${tm.findMs.toFixed(0)} ms, ${tm.banners} banners, ${tm.reads} reads, ocr ${tm.ocrMs.toFixed(0)} ms, match ${tm.matchMs.toFixed(0)} ms)`);
      console.log('  ' + acc.map(c => `${c.card}${c.pitch ? ` [${c.pitch}]` : c.pitchOptions.length > 1 ? ' [pitch?]' : ''}`).join(', '));
    }
  }
  await worker.terminate(); process.exit(0);
})();

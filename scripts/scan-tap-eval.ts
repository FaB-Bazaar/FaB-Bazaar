// scripts/scan-tap-eval.ts — EXPERIMENT: does a tap on a card the scan missed let a targeted read recover it?
// For every labelled binder page: normal scan -> which pockets have no accepted card -> simulated tap at that pocket's
// centre -> lib/scan/banner/read-at-point (the shipped targeted read). Counts recovered / WRONG / still missed.
//   npx tsx scripts/scan-tap-eval.ts [--corpus=<dir>] [--only=<file>]   (TESS_CACHE=<dir> keeps the OCR model out of the repo)
import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd());
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { buildNameIndex, normalizeName } from '@/lib/scan/banner/name-match';
import { scanPhoto } from '@/lib/scan/banner/scan-photo';
import type { RgbImage } from '@/lib/scan/banner/find-banners';
import { readAtPoint, estimateCardWidth } from '@/lib/scan/banner/read-at-point';

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find(a => a.startsWith(`${n}=`))?.slice(n.length + 1);
const CORPUS = arg('--corpus') ?? path.join(os.homedir(), 'Documents', 'FaB-Bazaar-Notes', 'scan-corpus', 'binder');

(async () => {
  const { PostgresPrintingsService } = await import('@/lib/services/postgres/printings/PostgresPrintingsService');
  const res = await new PostgresPrintingsService().getScanNameIndex(); if (!res.success) throw new Error(res.error);
  const index = buildNameIndex(res.data);
  const worker = await createWorker('eng', 1, { cachePath: process.env.TESS_CACHE ?? os.tmpdir() }); await worker.setParameters({ tessedit_pageseg_mode: '7' as any });
  const ocr = async (img: RgbImage) => (await worker.recognize(await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } }).png().toBuffer())).data.text;
  const pages = JSON.parse(fs.readFileSync(path.join(CORPUS, 'labels.json'), 'utf8')) as Array<{ file: string; bounds?: number[]; cards: Array<{ name: string | null; empty?: boolean; unknown?: boolean }> }>;
  const tot = { pockets: 0, foundByScan: 0, missed: 0, recovered: 0, wrong: 0, viaBar: 0, viaBlind: 0 };
  for (const p of pages.filter(p => p.bounds && p.file !== 'page-01-whatsapp.jpg' && (!arg('--only') || p.file === arg('--only')))) {
    const { data, info } = await sharp(path.join(CORPUS, p.file)).rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const img: RgbImage = { data, width: info.width, height: info.height, channels: 3 };
    const scan = await scanPhoto(img, index, ocr);
    const acc = scan.cards.filter(c => c.accepted);
    const [L, T, R, B] = [p.bounds![0] * img.width, p.bounds![1] * img.height, p.bounds![2] * img.width, p.bounds![3] * img.height];
    const cw = (R - L) / 3, chh = (B - T) / 3;
    const cardW = estimateCardWidth(acc.map(c => c.rect.w), img.width);
    const line: string[] = [];
    for (const [k, card] of p.cards.entries()) {
      if (card.empty || card.unknown || !card.name) continue;
      const r = Math.floor(k / 3), c = k % 3;
      const cell = { x0: L + c * cw, y0: T + r * chh, x1: L + (c + 1) * cw, y1: T + (r + 1) * chh };
      if (cell.y0 >= img.height || cell.x0 >= img.width) continue;   // pocket outside the photo
      tot.pockets++;
      const covered = acc.some(a => a.rect.cx >= cell.x0 && a.rect.cx < cell.x1 && a.rect.cy >= cell.y0 && a.rect.cy < cell.y1 && normalizeName(a.card) === normalizeName(card.name!));
      if (covered) { tot.foundByScan++; continue; }
      tot.missed++;
      const tap = { x: (cell.x0 + cell.x1) / 2, y: Math.min(img.height - 1, (cell.y0 + cell.y1) / 2) };
      const got = await readAtPoint(img, tap, cardW, index, ocr);
      if (!got) { line.push(`${k}:${card.name} -> still missed`); continue; }
      const ok = normalizeName(got.card.card) === normalizeName(card.name);
      if (ok) { tot.recovered++; got.how === 'bar' ? tot.viaBar++ : tot.viaBlind++; } else tot.wrong++;
      line.push(`${card.name} -> ${ok ? 'RECOVERED' : 'WRONG ' + got.card.card} (${got.how})`);
    }
    console.log(`${p.file.padEnd(24)} ${line.join(' | ') || 'nothing missed'}`);
  }
  console.log(`\nPOCKETS ${tot.pockets}: scan found ${tot.foundByScan}, missed ${tot.missed}; a tap recovered ${tot.recovered} (bar ${tot.viaBar}, blind ${tot.viaBlind}), WRONG ${tot.wrong}, still missed ${tot.missed - tot.recovered - tot.wrong}`);
  await worker.terminate(); process.exit(0);
})();

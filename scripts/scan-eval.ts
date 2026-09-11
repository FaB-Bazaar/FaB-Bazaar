/**
 * scripts/scan-eval.ts — measure scanner accuracy against the REAL hash index.
 * Samples hashed printings, degrades their render like a phone photo (tilt,
 * blur, brightness, downscale, JPEG), runs the real identify() and reports
 * how often the true card NAME is the top candidate (pitch/foiling are user
 * choices, not the scanner's job). Read-only.
 *   npx tsx scripts/scan-eval.ts --n=100 [--sets=pen,sea] [--harsh] [--scene]
 *   --scene: card on a table (background around it, tilt, perspective-ish) → exercises deskew
 *   --multi=3: N cards side by side in one photo → per-card top-1 through analyzeImageMulti
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import sharp from 'sharp';
import { analyzeImage, analyzeImageMulti } from '@/lib/scan/image-hash';
import { pickBetterIdentification } from '@/lib/scan/scan-session';

const argv = process.argv.slice(2);
const arg = (n: string) => { const h = argv.find(a => a.startsWith(`${n}=`)); return h ? h.slice(n.length + 1) : undefined; };
const N = parseInt(arg('--n') ?? '60', 10);
const SETS = arg('--sets')?.split(',');
const HARSH = argv.includes('--harsh');
const SCENE = argv.includes('--scene');
const MULTI = arg('--multi') ? parseInt(arg('--multi')!, 10) : 0;
const UA = { 'User-Agent': 'fabbazaar-scan-eval/1.0' };

const TABLES = ['#5a4632', '#2b2b2b', '#c9c2b4', '#3a4a5c', '#7a6a58'];

async function degrade(buf: Buffer, seed: number): Promise<Buffer> {
  const rot = ((seed % 7) - 3) * (HARSH ? 1.5 : 0.8);          // -4.5..4.5° or -2.4..2.4°
  const bright = 0.75 + (seed % 5) * 0.1;                       // 0.75..1.15
  const blur = HARSH ? 1.6 : 1.0;
  if (!SCENE) {
    return sharp(buf).rotate(rot, { background: '#2a2a2a' }).modulate({ brightness: bright, saturation: 0.9 })
      .blur(blur).resize({ width: HARSH ? 320 : 480 }).jpeg({ quality: HARSH ? 45 : 60 }).toBuffer();
  }
  // table scene: bigger tilt, background all round, then the same photo degradation
  const bg = TABLES[seed % TABLES.length];
  const tilt = ((seed % 9) - 4) * (HARSH ? 3 : 2);              // up to ±12° / ±8°
  const card = await sharp(buf).resize({ width: 300 }).toBuffer();
  const { data: rotated, info: m } = await sharp(card).rotate(tilt, { background: bg }).png().toBuffer({ resolveWithObject: true });
  const padX = 60 + (seed % 3) * 30, padY = 50 + (seed % 4) * 25;
  // composite in its own pipeline: sharp applies resize BEFORE composite whatever the call order
  const composed = await sharp({ create: { width: m.width + 2 * padX, height: m.height + 2 * padY, channels: 3, background: bg } })
    .composite([{ input: rotated, left: padX, top: padY }]).png().toBuffer();
  return sharp(composed).modulate({ brightness: bright, saturation: 0.9 }).blur(blur)
    .resize({ width: HARSH ? 420 : 640 }).jpeg({ quality: HARSH ? 45 : 60 }).toBuffer();
}

async function main() {
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');
  const { PostgresScanService } = await import('@/lib/services/postgres/scan/PostgresScanService');
  const service = new PostgresScanService();
  const setFilter = SETS ? sql`AND p.set = ANY(${SETS})` : sql``;
  const res = await db.execute(sql`
    SELECT h.printing_id, h.image_url, c.display_name AS name, c.pitch
    FROM printing_image_hashes h JOIN printings p ON p.printing_id = h.printing_id JOIN cards c ON c.card_unique_id = p.card_unique_id
    WHERE p.language = 'en' ${setFilter} ORDER BY md5(h.printing_id) LIMIT ${N}`);
  const rows: any[] = (res as any).rows ?? res;
  if (MULTI > 0) { await evalMulti(rows, service); process.exit(0); }
  let top1 = 0, top3 = 0, pitchOk = 0, pitchNull = 0, pitchWrong = 0, deskewedCount = 0, deskewedMiss = 0; const dists: number[] = []; const misses: string[] = [];
  const PITCH: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const orig = Buffer.from(await (await fetch(r.image_url, { headers: UA })).arrayBuffer());
    const photo = await degrade(orig, i);
    const a = await analyzeImage(photo);
    const primary = await service.identify(a.hashes, { limit: 5, pitchHint: a.pitchHint });
    if (!primary.success) throw new Error(primary.error);
    let chosen = { result: primary.data, hint: a.pitchHint, deskewed: a.deskewed };
    if (a.deskewed && a.flatHashes) {
      const flat = await service.identify(a.flatHashes, { limit: 5, pitchHint: a.flatPitchHint ?? null });
      if (flat.success) chosen = pickBetterIdentification(chosen, { result: flat.data, hint: a.flatPitchHint ?? null, deskewed: false });
    }
    const { deskewed, hint } = chosen;
    if (deskewed) deskewedCount++;
    const out = { success: true as const, data: chosen.result };
    const names = out.data.candidates.map(c => c.name);
    const rank = names.indexOf(r.name);
    if (rank === 0) top1++; if (rank >= 0 && rank < 3) top3++;
    if (rank === 0) dists.push(out.data.bestDistance ?? 0);
    if (rank !== 0) { misses.push(`${r.name} (${r.printing_id}) ${deskewed ? '[deskewed]' : '[flat]'} → ${names.slice(0, 3).join(' | ')} d=${out.data.bestDistance}`); if (deskewed) deskewedMiss++; }
    if (r.pitch) { if (hint === null) pitchNull++; else if (hint === PITCH[r.pitch]) pitchOk++; else pitchWrong++; }
  }
  dists.sort((a, b) => a - b);
  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`;
  console.log(`n=${rows.length} index=${(await service.listHashIndex() as any).data.length} mode=${HARSH ? 'harsh' : 'normal'}${SCENE ? '+scene' : ''} deskewed=${deskewedCount}/${rows.length}`);
  console.log(`top-1 by name: ${top1} (${pct(top1)})   top-3: ${top3} (${pct(top3)})   misses: ${rows.length - top1} (${deskewedMiss} of them deskewed)`);
  console.log(`match distance 0..256 (top-1 hits): min=${dists[0]} p50=${dists[Math.floor(dists.length / 2)]} p90=${dists[Math.floor(dists.length * 0.9)]} max=${dists[dists.length - 1]}`);
  const missD = misses.map(m => Number(m.match(/d=(\d+)/)?.[1])).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  if (missD.length) console.log(`wrong-match distance: min=${missD[0]} p50=${missD[Math.floor(missD.length / 2)]}`);
  const withPitch = pitchOk + pitchNull + pitchWrong;
  console.log(`pitch hint (of ${withPitch} pitched cards): right=${pitchOk} none=${pitchNull} wrong=${pitchWrong}`);
  if (misses.length) { console.log('misses:'); for (const m of misses.slice(0, 15)) console.log('  ' + m); }
  process.exit(0);
}
/** N cards laid side by side on a table per photo; every card must be found AND matched. */
async function evalMulti(rows: any[], service: any) {
  const groups: any[][] = [];
  for (let i = 0; i + MULTI <= rows.length; i += MULTI) groups.push(rows.slice(i, i + MULTI));
  let photos = 0, cardsTotal = 0, found = 0, top1 = 0, extra = 0;
  const misses: string[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const bg = TABLES[gi % TABLES.length];
    const cards = await Promise.all(group.map(async (r, k) => {
      const orig = Buffer.from(await (await fetch(r.image_url, { headers: UA })).arrayBuffer());
      return sharp(orig).resize({ width: 260 }).rotate(((gi + k) % 5 - 2) * 2, { background: bg }).png().toBuffer({ resolveWithObject: true });
    }));
    const gap = 30 + (gi % 3) * 15, pad = 40 + (gi % 4) * 15;
    const W = cards.reduce((n, c) => n + c.info.width, 0) + gap * (cards.length - 1) + 2 * pad;
    const H = Math.max(...cards.map(c => c.info.height)) + 2 * pad;
    let left = pad;
    const composite = cards.map(c => { const it = { input: c.data, left, top: pad }; left += c.info.width + gap; return it; });
    const composed = await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(composite).png().toBuffer();
    const photo = await sharp(composed).modulate({ brightness: 0.8 + (gi % 4) * 0.1 }).blur(HARSH ? 1.4 : 0.9).resize({ width: HARSH ? 800 : 1100 }).jpeg({ quality: HARSH ? 45 : 60 }).toBuffer();
    const analyses = await analyzeImageMulti(photo);
    photos++; cardsTotal += group.length;
    const deskewedOnes = analyses.filter(a => a.deskewed);
    found += Math.min(deskewedOnes.length, group.length);
    extra += Math.max(0, deskewedOnes.length - group.length);
    // score by set membership: which of the photo's cards appear among the found quads' top-1 names
    const winners: string[] = [];
    for (const a of deskewedOnes) {
      const out = await service.identify(a.hashes, { limit: 1, pitchHint: a.pitchHint });
      winners.push(out.success && out.data.candidates[0] ? out.data.candidates[0].name : '');
    }
    for (const r of group) {
      const at = winners.indexOf(r.name);
      if (at >= 0) { top1++; winners[at] = ''; } else misses.push(`${r.name}: ${deskewedOnes.length < group.length ? 'maybe not found' : 'wrong'} — found names: ${winners.filter(Boolean).join(' | ') || '—'} (photo ${gi})`);
    }
  }
  const pct = (n: number) => `${((100 * n) / cardsTotal).toFixed(1)}%`;
  console.log(`multi=${MULTI} photos=${photos} cards=${cardsTotal} mode=${HARSH ? 'harsh' : 'normal'}`);
  console.log(`cards found: ${found} (${pct(found)})   phantom quads: ${extra}   top-1 of found: ${top1} (${pct(top1)} of all cards)`);
  if (misses.length) { console.log('misses:'); for (const m of misses.slice(0, 12)) console.log('  ' + m); }
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * scripts/scan-eval.ts — measure scanner accuracy against the REAL hash index.
 * Samples hashed printings, degrades their render like a phone photo (tilt,
 * blur, brightness, downscale, JPEG), runs the real identify() and reports
 * how often the true card NAME is the top candidate (pitch/foiling are user
 * choices, not the scanner's job). Read-only.
 *   npx tsx scripts/scan-eval.ts --n=100 [--sets=pen,sea] [--harsh]
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import sharp from 'sharp';
import { hashImage, pitchHint } from '@/lib/scan/image-hash';

const argv = process.argv.slice(2);
const arg = (n: string) => { const h = argv.find(a => a.startsWith(`${n}=`)); return h ? h.slice(n.length + 1) : undefined; };
const N = parseInt(arg('--n') ?? '60', 10);
const SETS = arg('--sets')?.split(',');
const HARSH = argv.includes('--harsh');
const UA = { 'User-Agent': 'fabbazaar-scan-eval/1.0' };

function degrade(buf: Buffer, seed: number) {
  const rot = ((seed % 7) - 3) * (HARSH ? 1.5 : 0.8);          // -4.5..4.5° or -2.4..2.4°
  const bright = 0.75 + (seed % 5) * 0.1;                       // 0.75..1.15
  const blur = HARSH ? 1.6 : 1.0;
  return sharp(buf).rotate(rot, { background: '#2a2a2a' }).modulate({ brightness: bright, saturation: 0.9 })
    .blur(blur).resize({ width: HARSH ? 320 : 480 }).jpeg({ quality: HARSH ? 45 : 60 }).toBuffer();
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
  let top1 = 0, top3 = 0, pitchOk = 0, pitchNull = 0, pitchWrong = 0; const dists: number[] = []; const misses: string[] = [];
  const PITCH: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const orig = Buffer.from(await (await fetch(r.image_url, { headers: UA })).arrayBuffer());
    const photo = await degrade(orig, i);
    const [h, hint] = await Promise.all([hashImage(photo), pitchHint(photo)]);
    const out = await service.identify(h, { limit: 5, pitchHint: hint });
    if (!out.success) throw new Error(out.error);
    const names = out.data.candidates.map(c => c.name);
    const rank = names.indexOf(r.name);
    if (rank === 0) top1++; if (rank >= 0 && rank < 3) top3++;
    if (rank === 0) dists.push(out.data.bestDistance ?? 0);
    if (rank !== 0) misses.push(`${r.name} (${r.printing_id}) → ${names.slice(0, 3).join(' | ')} d=${out.data.bestDistance}`);
    if (r.pitch) { if (hint === null) pitchNull++; else if (hint === PITCH[r.pitch]) pitchOk++; else pitchWrong++; }
  }
  dists.sort((a, b) => a - b);
  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`;
  console.log(`n=${rows.length} index=${(await service.listHashIndex() as any).data.length} mode=${HARSH ? 'harsh' : 'normal'}`);
  console.log(`top-1 by name: ${top1} (${pct(top1)})   top-3: ${top3} (${pct(top3)})`);
  console.log(`match distance (top-1 hits): min=${dists[0]} p50=${dists[Math.floor(dists.length / 2)]} p90=${dists[Math.floor(dists.length * 0.9)]} max=${dists[dists.length - 1]}`);
  const withPitch = pitchOk + pitchNull + pitchWrong;
  console.log(`pitch hint (of ${withPitch} pitched cards): right=${pitchOk} none=${pitchNull} wrong=${pitchWrong}`);
  if (misses.length) { console.log('misses:'); for (const m of misses.slice(0, 15)) console.log('  ' + m); }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

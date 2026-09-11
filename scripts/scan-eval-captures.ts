/**
 * scripts/scan-eval-captures.ts — measure the scanner on REAL labelled photos.
 *
 * Labelled captures come from normal use of /scan: an "Add to binder" labels
 * the suggested card as accepted, the "Not this card? search" box labels the
 * corrected card. This script pulls them (superadmin bearer), caches them in
 * a corpus directory, runs the CURRENT local pipeline over every photo and
 * reports found / deskewed / top-1 / distance per photo plus totals.
 *
 *   INGEST_BEARER=… npx tsx scripts/scan-eval-captures.ts --sync          # pull new labelled captures into the corpus
 *   npx tsx scripts/scan-eval-captures.ts                                  # evaluate the corpus with the local pipeline + index
 *   --corpus=<dir>   default ~/Documents/FaB-Bazaar-Notes/scan-corpus (photos + labels.json, survives the server's TTL)
 *   --base-url=…     default https://fabbazaar.app
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const arg = (n: string) => { const h = argv.find(a => a.startsWith(`${n}=`)); return h ? h.slice(n.length + 1) : undefined; };
const SYNC = argv.includes('--sync');
const BASE_URL = (arg('--base-url') ?? 'https://fabbazaar.app').replace(/\/+$/, '');
const CORPUS = arg('--corpus') ?? path.join(os.homedir(), 'Documents', 'FaB-Bazaar-Notes', 'scan-corpus');
const BEARER = process.env.INGEST_BEARER;

interface LabelEntry { id: string; file: string; printingId: string; cardName: string; source: string; createdAt: number; outcomeAtScan: { topName: string | null; bestDistance: number | null; cardsFound: number } }

function loadLabels(): LabelEntry[] { const f = path.join(CORPUS, 'labels.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; }
function saveLabels(l: LabelEntry[]) { fs.mkdirSync(CORPUS, { recursive: true }); fs.writeFileSync(path.join(CORPUS, 'labels.json'), JSON.stringify(l, null, 2)); }

async function sync() {
  if (!BEARER) { console.error('Set INGEST_BEARER (superadmin token) to sync captures'); process.exit(1); }
  const headers = { Authorization: `Bearer ${BEARER}`, 'User-Agent': 'FaBBazaar-ScanCorpus/1.0' };
  const res = await fetch(`${BASE_URL}/api/admin/scan/captures`, { headers });
  const json: any = await res.json();
  if (!res.ok || !json.success) { console.error('list failed', res.status, json.error ?? ''); process.exit(1); }
  const labels = loadLabels(); const have = new Set(labels.map(l => l.id)); let added = 0;
  for (const c of json.data.captures) {
    if (!c.label || have.has(c.id)) continue;
    const img = await fetch(`${BASE_URL}${c.url}`, { headers });
    if (!img.ok) { console.warn('skip', c.id, img.status); continue; }
    const ext = c.contentType === 'image/png' ? 'png' : 'jpg';
    const file = `${c.id}.${ext}`;
    fs.mkdirSync(CORPUS, { recursive: true });
    fs.writeFileSync(path.join(CORPUS, file), Buffer.from(await img.arrayBuffer()));
    labels.push({ id: c.id, file, printingId: c.label.printingId, cardName: c.label.cardName, source: c.label.source, createdAt: c.createdAt, outcomeAtScan: { topName: c.outcome.topName, bestDistance: c.outcome.bestDistance, cardsFound: c.outcome.cardsFound } });
    added++;
  }
  saveLabels(labels);
  console.log(`corpus: ${labels.length} labelled photos (${added} new) in ${CORPUS}`);
}

async function evaluate() {
  const labels = loadLabels();
  if (labels.length === 0) { console.log(`no labelled photos in ${CORPUS} — run with --sync first`); process.exit(0); }
  const { analyzeImageMulti } = await import('@/lib/scan/image-hash');
  const { pickBetterIdentification, matchConfidence } = await import('@/lib/scan/scan-session');
  const { PostgresScanService } = await import('@/lib/services/postgres/scan/PostgresScanService');
  const svc = new PostgresScanService();
  let found = 0, top1 = 0, top3 = 0, confident = 0, confidentWrong = 0; const rows: string[] = [];
  for (const l of labels) {
    const buf = fs.readFileSync(path.join(CORPUS, l.file));
    const analyses = await analyzeImageMulti(buf);
    // the labelled card is whichever analysed card ranks it best
    let best: { names: string[]; dist: number | null; deskewed: boolean } | null = null;
    for (const a of analyses) {
      const p = await svc.identify(a.hashes, { limit: 3, pitchHint: a.pitchHint }); if (!p.success) continue;
      let chosen = { result: p.data, deskewed: a.deskewed };
      if (a.deskewed && a.flatHashes) { const f = await svc.identify(a.flatHashes, { limit: 3 }); if (f.success) chosen = pickBetterIdentification(chosen, { result: f.data, deskewed: false }); }
      const names = chosen.result.candidates.map(c => c.name);
      const cand = { names, dist: chosen.result.bestDistance, deskewed: chosen.deskewed };
      if (!best || names.indexOf(l.cardName) !== -1 && (best.names.indexOf(l.cardName) === -1)) best = cand;
      else if (!best) best = cand;
    }
    const names = best?.names ?? []; const rank = names.indexOf(l.cardName);
    const label = matchConfidence(best?.dist ?? null);
    if (best?.deskewed) found++;
    if (rank === 0) top1++; if (rank >= 0 && rank < 3) top3++;
    if (label === 'confident') { confident++; if (rank !== 0) confidentWrong++; }
    rows.push(`${rank === 0 ? '✓' : rank > 0 ? '~' : '✗'} ${l.cardName.padEnd(30)} ${best?.deskewed ? 'deskewed' : 'flat    '} d=${String(best?.dist ?? '-').padStart(3)} ${label.padEnd(9)} top: ${names.slice(0, 2).join(' | ')}  [at scan: ${l.outcomeAtScan.topName ?? '-'} d=${l.outcomeAtScan.bestDistance ?? '-'}; ${l.source}]`);
  }
  const n = labels.length; const pct = (v: number) => `${((100 * v) / n).toFixed(1)}%`;
  console.log(rows.join('\n'));
  console.log(`\nreal photos: n=${n}  card found (deskewed): ${found} (${pct(found)})  top-1: ${top1} (${pct(top1)})  top-3: ${top3} (${pct(top3)})  labelled confident: ${confident}, of which wrong: ${confidentWrong}`);
  process.exit(0);
}

(SYNC ? sync() : evaluate()).catch(e => { console.error(e); process.exit(1); });

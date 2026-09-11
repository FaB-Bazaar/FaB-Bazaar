// lib/scan/dataset-import.ts — map the fab-cube dataset's precomputed hashes
// (csvs/english/card-printing.csv: `Image Hash Full` / `Image Hash Art`,
// decimal strings) onto our printings via the fab_cube_printing_id anchor.
// Pure; scripts/import-dataset-hashes.ts does the I/O.
import { decimalToHex } from './phash-exact';

export interface DatasetHashRow { uniqueId: string; phashFull: string; phashArt: string }
export interface OurPrinting { printingId: string; fabCubePrintingId: string | null; imageUrl: string | null }
export interface ImportRow { printingId: string; phash: string; dhash: null; artHash: string | null; imageUrl: string }

export interface DatasetImportPlan {
  rows: ImportRow[];
  /** Our printings with an image but no fab-cube anchor: hash them locally (compute-image-hashes.ts --sets=…). */
  unanchored: string[];
  /** Anchored printings whose dataset row has no hash yet. */
  unhashedInDataset: string[];
  /** Dataset rows for printings we don't have. */
  unknownDatasetIds: number;
}

export function planDatasetImport(theirs: DatasetHashRow[], ours: OurPrinting[]): DatasetImportPlan {
  const byId = new Map(theirs.map(t => [t.uniqueId, t]));
  const ourIds = new Set(ours.map(o => o.fabCubePrintingId).filter((x): x is string => !!x));
  const rows: ImportRow[] = [], unanchored: string[] = [], unhashedInDataset: string[] = [];
  for (const o of ours) {
    if (!o.fabCubePrintingId) { if (o.imageUrl) unanchored.push(o.printingId); continue; }
    const t = byId.get(o.fabCubePrintingId);
    if (!t || !t.phashFull) { unhashedInDataset.push(o.printingId); continue; }
    if (!o.imageUrl) { unhashedInDataset.push(o.printingId); continue; }
    rows.push({ printingId: o.printingId, phash: decimalToHex(t.phashFull), dhash: null, artHash: t.phashArt ? decimalToHex(t.phashArt) : null, imageUrl: o.imageUrl });
  }
  const unknownDatasetIds = theirs.filter(t => !ourIds.has(t.uniqueId)).length;
  return { rows, unanchored, unhashedInDataset, unknownDatasetIds };
}

/** Minimal RFC-4180-style reader for the dataset's tab-separated CSV (quoted fields may hold tabs, quotes and newlines). */
export function parseDatasetTsv(text: string): DatasetHashRow[] {
  const records: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; records.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); records.push(row); }
  const header = records[0] ?? [];
  const iu = header.indexOf('Unique ID'), iF = header.indexOf('Image Hash Full'), iA = header.indexOf('Image Hash Art');
  if (iu < 0 || iF < 0 || iA < 0) throw new Error(`expected columns Unique ID / Image Hash Full / Image Hash Art, got: ${header.filter(Boolean).slice(0, 8).join(', ')} …`);
  return records.slice(1).filter(r => r[iu]).map(r => ({ uniqueId: r[iu].trim(), phashFull: (r[iF] ?? '').trim(), phashArt: (r[iA] ?? '').trim() }));
}

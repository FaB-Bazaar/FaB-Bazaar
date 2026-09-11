// lib/scan/hash-rows.ts — validate hash rows pushed to POST /api/admin/scan/hashes.
// Pure. The upsert is ONE multi-row INSERT … ON CONFLICT, which fails if a
// key appears twice in the batch, so rows are deduped here (last wins).

export const MAX_HASH_ROWS_PER_REQUEST = 1000;
const HEX16 = /^[0-9a-f]{16}$/i;

export interface HashRow {
  printingId: string;
  phash: string;
  dhash: string | null;
  artHash: string | null;
  imageUrl: string;
}

export type ValidateResult = { ok: true; rows: HashRow[] } | { ok: false; error: string };

export function validateHashRows(input: unknown): ValidateResult {
  if (!Array.isArray(input)) return { ok: false, error: 'rows must be an array' };
  if (input.length === 0) return { ok: false, error: 'rows is empty' };
  if (input.length > MAX_HASH_ROWS_PER_REQUEST) return { ok: false, error: `rows: at most ${MAX_HASH_ROWS_PER_REQUEST} per request` };
  const byId = new Map<string, HashRow>();
  for (let i = 0; i < input.length; i++) {
    const r = input[i] as Record<string, unknown>;
    if (!r || typeof r !== 'object') return { ok: false, error: `row ${i}: not an object` };
    if (typeof r.printingId !== 'string' || !r.printingId) return { ok: false, error: `row ${i}: printingId is required` };
    if (typeof r.phash !== 'string' || !HEX16.test(r.phash)) return { ok: false, error: `row ${i}: phash must be 16 hex chars` };
    let dhash: string | null = null;
    if (r.dhash !== undefined && r.dhash !== null) {
      if (typeof r.dhash !== 'string' || !HEX16.test(r.dhash)) return { ok: false, error: `row ${i}: dhash must be 16 hex chars or null` };
      dhash = r.dhash.toLowerCase();
    }
    let artHash: string | null = null;
    if (r.artHash !== undefined && r.artHash !== null) {
      if (typeof r.artHash !== 'string' || !HEX16.test(r.artHash)) return { ok: false, error: `row ${i}: artHash must be 16 hex chars or null` };
      artHash = r.artHash.toLowerCase();
    }
    if (typeof r.imageUrl !== 'string' || !r.imageUrl) return { ok: false, error: `row ${i}: imageUrl is required` };
    byId.set(r.printingId, { printingId: r.printingId, phash: r.phash.toLowerCase(), dhash, artHash, imageUrl: r.imageUrl });
  }
  return { ok: true, rows: [...byId.values()] };
}

export function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

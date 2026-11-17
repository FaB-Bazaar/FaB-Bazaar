/**
 * Integration tests for PostgresPrintingsService.resolvePrintCodes.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Purpose: the print-code CSV import (partner contract, see
 * lib/import/print-code.ts) names each printing with ONE code — our image id
 * (ARC159-RF-1E) or CardVault's print_id (U-ARC029-RF, JA_OBK001-MV). Exact
 * matches win; anything else is parsed into attributes and matched.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

async function one(code: string) {
  const result = await service.resolvePrintCodes([code]);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return result.data[0];
}

let twinPrintingId: string;
let duplicatedCode: string;
let lssHosted: { printingId: string; code: string };
let lssOnly: { printingId: string; code: string };

beforeAll(async () => {
  // A printing whose image is keyed by its printing_id (identical-twin rows).
  const twin = await db.execute<{ printing_id: string }>(sql`
    SELECT printing_id FROM printings
    WHERE image_url LIKE '%/' || printing_id || '/public' AND language = 'en'
    ORDER BY printing_id LIMIT 1`);
  twinPrintingId = twin.rows[0].printing_id;

  // An image id two printings share.
  const dup = await db.execute<{ code: string }>(sql`
    SELECT substring(image_url from '/([^/]+)/public$') AS code FROM printings
    WHERE image_url LIKE 'https://imagedelivery.net/%'
      AND substring(image_url from '/([^/]+)/public$') <> printing_id
    GROUP BY 1 HAVING count(*) > 1 ORDER BY 1 LIMIT 1`);
  duplicatedCode = dup.rows[0].code;

  // A printing whose image is still CardVault-hosted (…/large/IAR187-RF.webp).
  const hosted = await db.execute<{ printing_id: string; code: string }>(sql`
    SELECT printing_id, substring(image_url from '/([^/]+)\.webp$') AS code FROM printings
    WHERE image_url LIKE '%.webp'
      AND (SELECT count(*) FROM printings p2
           WHERE p2.image_url = printings.image_url) = 1
    ORDER BY printing_id LIMIT 1`);
  lssHosted = { printingId: hosted.rows[0].printing_id, code: hosted.rows[0].code };

  // A CardVault print code that differs from the row's image id.
  const lss = await db.execute<{ printing_id: string; code: string }>(sql`
    SELECT printing_id, lss_print_code AS code FROM printings p
    WHERE lss_print_code IS NOT NULL
      AND lss_print_code <> coalesce(substring(image_url from '/([^/]+)/public$'), '')
      AND (SELECT count(*) FROM printings p2 WHERE p2.lss_print_code = p.lss_print_code) = 1
    ORDER BY printing_id LIMIT 1`);
  lssOnly = { printingId: lss.rows[0].printing_id, code: lss.rows[0].code };
});

describe('PostgresPrintingsService.resolvePrintCodes', () => {
  it('returns one entry per input code, in order', async () => {
    const result = await service.resolvePrintCodes(['ARC159-RF-1E', 'ZZZ999', 'ARC159-RF-1E']);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map(r => r.code)).toEqual(['ARC159-RF-1E', 'ZZZ999', 'ARC159-RF-1E']);
  });

  it('resolves our image id exactly', async () => {
    const r = await one('ARC159-RF-1E');
    expect(r.status).toBe('ok');
    expect(r.printing).toMatchObject({ collector_number: 'ARC159', foiling: 'r', edition: 'f', language: 'en' });
  });

  it('resolves a printing_id-keyed twin by its image id (= printing_id)', async () => {
    const r = await one(twinPrintingId);
    expect(r.status).toBe('ok');
    expect(r.printing?.printing_id).toBe(twinPrintingId);
  });

  it('resolves a CardVault-hosted row by its image file name', async () => {
    const r = await one(lssHosted.code);
    expect(r.status).toBe('ok');
    expect(r.printing?.printing_id).toBe(lssHosted.printingId);
  });

  it('resolves a stored CardVault print code', async () => {
    const r = await one(lssOnly.code);
    expect(r.status).toBe('ok');
    expect(r.printing?.printing_id).toBe(lssOnly.printingId);
  });

  it('reports a code two printings share as ambiguous, with both candidates', async () => {
    const r = await one(duplicatedCode);
    expect(r.status).toBe('ambiguous');
    expect(r.candidates?.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to attributes for a CardVault code we never stored', async () => {
    const u = await one('U-ARC159-RF');
    expect(u.status).toBe('ok');
    expect(u.printing).toMatchObject({ collector_number: 'ARC159', foiling: 'r', edition: 'u' });

    // Unprefixed CardVault code on a 1st/Unlimited set = 1st edition.
    const f = await one('ARC159');
    expect(f.status).toBe('ok');
    expect(f.printing).toMatchObject({ collector_number: 'ARC159', foiling: 's', edition: 'f' });
  });

  it('is case-insensitive for attribute codes', async () => {
    const r = await one('arc159-rf-1e');
    expect(r.status).toBe('ok');
    expect(r.printing).toMatchObject({ collector_number: 'ARC159', foiling: 'r', edition: 'f' });
  });

  it('reports an unknown code as not_found', async () => {
    expect((await one('ZZZ999')).status).toBe('not_found');
    expect((await one('ARC159-GF')).status).toBe('not_found');
  });

  it('handles an empty list', async () => {
    const result = await service.resolvePrintCodes([]);
    expect(result).toEqual({ success: true, data: [] });
  });
});

describe('PostgresPrintingsService.listPrintCodeCatalog', () => {
  it('gives every printing a code no other printing shares', async () => {
    const result = await service.listPrintCodeCatalog();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const total = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM printings`);
    expect(result.data.length).toBe(total.rows[0].n);
    expect(new Set(result.data.map(r => r.print_code)).size).toBe(result.data.length);
    expect(result.data.every(r => r.print_code && r.printing_id && r.name)).toBe(true);
  });

  it('names cards the way they are printed, not the lowercase search key', async () => {
    const result = await service.listPrintCodeCatalog();
    if (!result.success) throw new Error(result.error);
    expect(result.data.find(r => r.print_code === 'ARC159-RF-1E')?.name).toBe('Command and Conquer');
  });

  it('round-trips: each catalog code resolves to its own printing', async () => {
    const result = await service.listPrintCodeCatalog();
    if (!result.success) throw new Error(result.error);
    // a sample across the table + rows whose code falls back to printing_id
    // (twins and the duplicated image ids)
    const sample = [
      ...result.data.filter((_, i) => i % 250 === 0),
      ...result.data.filter(r => r.print_code === r.printing_id).slice(0, 40),
    ];
    const resolved = await service.resolvePrintCodes(sample.map(r => r.print_code));
    if (!resolved.success) throw new Error(resolved.error);
    const wrong = resolved.data
      .map((r, i) => ({ code: r.code, status: r.status, got: r.printing?.printing_id, want: sample[i].printing_id }))
      .filter(r => r.status !== 'ok' || r.got !== r.want);
    expect(wrong).toEqual([]);
  });
});

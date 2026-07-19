// app/api/collection/fabrary-import/resolve/route.ts
// Step 1: Parse CSV and resolve each row to a printing_id.
// Returns resolved inventory/wants items and unresolved rows for preview before committing.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { printingsService } from '@/lib/services';
import {
  parseFabraryCsv,
  type FabraryParsedRow,
  type FabraryResolveResult,
} from '@/lib/utils/fabrary-csv';
import type { PrintingDTO } from '@/lib/services/contracts/IPrintingsService';

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  let csvText: string;
  try {
    const formData = await request.formData();
    const file = formData.get('csv');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No CSV file provided.' }, { status: 400 });
    }
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read uploaded file.' }, { status: 400 });
  }

  const { rows, errors: parseErrors } = parseFabraryCsv(csvText);

  if (parseErrors.length > 0 && rows.length === 0) {
    return NextResponse.json({ error: parseErrors[0] }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows with quantity data found in the CSV.' }, { status: 400 });
  }

  // Batch collector number lookups to avoid truncation from a single query limit.
  // Each collector number can map to ~3+ printings, so 500 per batch stays well under reasonable limits.
  const uniqueCollectorNumbers = [...new Set(rows.map(r => r.collectorNumber))];
  const BATCH_SIZE = 500;
  const byCollectorNumber = new Map<string, PrintingDTO[]>();

  for (let i = 0; i < uniqueCollectorNumbers.length; i += BATCH_SIZE) {
    const batch = uniqueCollectorNumbers.slice(i, i + BATCH_SIZE);
    const printingsResult = await printingsService.searchPrintings(
      { collectorNumber: batch },
      { limit: batch.length * 10 }
    );
    if (!printingsResult.success) {
      return NextResponse.json({ error: 'Failed to load card data.' }, { status: 500 });
    }
    for (const p of printingsResult.data.printings) {
      const cn = (p.collector_number || '').toUpperCase();
      const existing = byCollectorNumber.get(cn);
      if (existing) existing.push(p);
      else byCollectorNumber.set(cn, [p]);
    }
  }

  const result: FabraryResolveResult = {
    inventory: [],
    wants: [],
    unresolved: [],
    totalParsedRows: rows.length,
  };

  for (const row of rows) {
    const candidates = byCollectorNumber.get(row.collectorNumber) ?? [];

    if (candidates.length === 0) {
      result.unresolved.push({ collectorNumber: row.collectorNumber, name: row.name, reason: 'not found in database' });
      continue;
    }

    const printing = resolvePrinting(row, candidates);
    if (!printing) {
      result.unresolved.push({ collectorNumber: row.collectorNumber, name: row.name, reason: 'ambiguous — could not determine exact printing' });
      continue;
    }

    if (row.hasInventory) {
      result.inventory.push({ printingId: printing.printing_id, quantity: row.inventoryQty, forTrade: row.forTrade });
    }
    if (row.hasWants) {
      result.wants.push({ printingId: printing.printing_id, quantity: row.wantsQty });
    }
  }

  return NextResponse.json({ success: true, data: result });
}

export function resolvePrinting(row: FabraryParsedRow, candidates: PrintingDTO[]): PrintingDTO | null {
  // Fabrary exports carry no language column, so the ENGLISH printing is the
  // only correct target — foreign-language siblings are attribute-identical
  // (same foiling/edition/art) and would make every row ambiguous. Foreign-
  // EXCLUSIVE sets (2HP/RAP) have no English row, so fall back to all
  // candidates there.
  const english = candidates.filter(p => (p.language ?? 'en') === 'en');
  if (english.length > 0) candidates = english;

  // Filter by foiling + edition
  let filtered = candidates.filter(p => p.foiling === row.foiling && p.edition === row.edition);

  // Filter by art_variations
  if (row.treatments.length > 0) {
    filtered = filtered.filter(p =>
      row.treatments.every(t => (p.art_variations ?? []).includes(t))
    );
  } else {
    // No treatment specified — prefer printings with no art variations
    const plain = filtered.filter(p => (p.art_variations ?? []).length === 0);
    if (plain.length > 0) filtered = plain;
  }

  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 0) return null;

  // Tiebreak by card name (DFC collisions where two cards share a collector number)
  const nameLower = row.name.toLowerCase();
  const nameMatch = filtered.filter(p => p.name.toLowerCase() === nameLower);
  if (nameMatch.length === 1) return nameMatch[0];

  // Prefer front face
  const frontFace = filtered.filter(p => p.is_front_face !== false);
  if (frontFace.length === 1) return frontFace[0];

  return null;
}

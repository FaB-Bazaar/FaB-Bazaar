// app/api/printings/bulk-search/route.ts
//
// Accepts an array of card descriptors and returns all printings for each
// in a single DB round-trip. Replaces N parallel /api/printings/search calls
// from the bulk-import page and the deck editor search tab.

import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import type { PrintingDTO, PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

const COLOR_TO_PITCH: Record<string, number> = {
  red: 1, yellow: 2, blue: 3,
};

export interface BulkSearchCard {
  name: string;
  color?: string;       // 'red' | 'yellow' | 'blue' | ''
  exact?: boolean;
  isPartialMatch?: boolean;
  foiling?: string;     // post-filter
  set?: string;         // post-filter
  edition?: string;     // post-filter
  collectorNumber?: string; // "WTR001" — resolves by set printing instead of name
}

export interface BulkSearchResult {
  index: number;
  printings: PrintingDTO[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cards: BulkSearchCard[] = body?.cards;

    // Optional shared constraints applied to all cards (hero/format legality)
    const sharedFilters: Pick<PrintingsSearchFilters, 'heroClasses' | 'heroTalents' | 'heroEssences' | 'format'> | undefined =
      (body?.heroClasses || body?.heroTalents || body?.heroEssences || body?.format)
        ? {
            heroClasses:  body.heroClasses  ?? undefined,
            heroTalents:  body.heroTalents  ?? undefined,
            heroEssences: body.heroEssences ?? undefined,
            format:       body.format       ?? undefined,
          }
        : undefined;

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'cards array is required' }, { status: 400 });
    }

    // Split: collector-number cards → one bulkResolveByCollectorNumber query
    //        exact-name cards → one bulkResolveByName query
    //        partial-match cards → individual fuzzy queries (rare)
    const collectorIndices: number[] = [];
    const exactIndices: number[] = [];
    const partialIndices: number[] = [];

    cards.forEach((c, i) => {
      if (c.collectorNumber) {
        collectorIndices.push(i);
      } else if (c.isPartialMatch) {
        partialIndices.push(i);
      } else {
        exactIndices.push(i);
      }
    });

    // ── Collector-number cards: one query ─────────────────────────────────────
    const collectorResult = collectorIndices.length > 0
      ? await printingsService.bulkResolveByCollectorNumber(
          collectorIndices.map(i => cards[i].collectorNumber!),
          sharedFilters
        )
      : { success: true as const, data: [] };

    if (!collectorResult.success) {
      return NextResponse.json({ error: collectorResult.error }, { status: 500 });
    }

    // ── Exact-name cards: one query with shared AND constraints ───────────────
    const exactInputs = exactIndices.map(i => ({
      name: cards[i].name,
      pitch: COLOR_TO_PITCH[cards[i].color ?? ''] ?? undefined,
    }));

    const bulkResult = exactInputs.length > 0
      ? await printingsService.bulkResolveByName(exactInputs, sharedFilters)
      : { success: true as const, data: [] };

    if (!bulkResult.success) {
      return NextResponse.json({ error: bulkResult.error }, { status: 500 });
    }

    // ── Partial-match cards: individual searches (rare case) ──────────────────
    const partialResults = await Promise.all(
      partialIndices.map(i => {
        const c = cards[i];
        const filters: PrintingsSearchFilters = { name: c.name };
        if (c.color) filters.color = c.color;
        if (sharedFilters?.heroClasses)  filters.heroClasses  = sharedFilters.heroClasses;
        if (sharedFilters?.heroTalents)  filters.heroTalents  = sharedFilters.heroTalents;
        if (sharedFilters?.heroEssences) filters.heroEssences = sharedFilters.heroEssences;
        if (sharedFilters?.format)       filters.format       = sharedFilters.format;
        return printingsService.searchPrintings(filters, { limit: 50 });
      })
    );

    // ── Assemble output indexed to original card positions ────────────────────
    const results: BulkSearchResult[] = cards.map((_, i) => ({ index: i, printings: [] }));

    // Post-filter by set / edition / foiling if specified per-card
    const applyCardFilters = (card: BulkSearchCard, printings: PrintingDTO[]) => {
      if (card.set)     printings = printings.filter(p => p.set === card.set!.toLowerCase());
      if (card.edition) printings = printings.filter(p => p.edition === card.edition);
      if (card.foiling) printings = printings.filter(p => p.foiling === card.foiling);
      return printings;
    };

    collectorIndices.forEach((originalIdx, collectorIdx) => {
      results[originalIdx].printings = applyCardFilters(
        cards[originalIdx],
        collectorResult.data[collectorIdx]?.printings ?? []
      );
    });

    exactIndices.forEach((originalIdx, bulkIdx) => {
      results[originalIdx].printings = applyCardFilters(
        cards[originalIdx],
        bulkResult.data[bulkIdx]?.printings ?? []
      );
    });

    partialIndices.forEach((originalIdx, partialIdx) => {
      const res = partialResults[partialIdx];
      results[originalIdx].printings = applyCardFilters(
        cards[originalIdx],
        res.success ? (res.data?.printings ?? []) : []
      );
    });

    return NextResponse.json({ success: true, data: { results } });
  } catch (error) {
    console.error('[BulkSearch] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

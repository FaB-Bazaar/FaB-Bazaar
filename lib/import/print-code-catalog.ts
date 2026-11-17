// lib/import/print-code-catalog.ts
// In-memory cache for the public print-code catalog CSV (~47k rows, a few MB).
// The catalog only changes when printings are added (set ingest / nightly
// pipeline), so a few hours of staleness is fine. Per-container, like the
// other in-memory caches — fine while the app runs as one container.
import { formatPrintCodeCatalogCsv, type PrintCodeCatalogRow } from './print-code';
import type { AsyncResult } from '@/lib/services/contracts/common';

const TTL_MS = 6 * 60 * 60 * 1000;
let cached: { csv: string; at: number } | null = null;

export async function getCatalogCsv(
  load: () => AsyncResult<PrintCodeCatalogRow[]>,
): AsyncResult<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return { success: true, data: cached.csv };
  const rows = await load();
  if (!rows.success) return rows;
  cached = { csv: formatPrintCodeCatalogCsv(rows.data), at: Date.now() };
  return { success: true, data: cached.csv };
}

export function resetCatalogCsvCache(): void {
  cached = null;
}

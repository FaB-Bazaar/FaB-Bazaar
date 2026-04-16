// lib/fab-printings-search.ts
// Compatibility shim — delegates to printingsService (PostgreSQL).
// Previously contained direct MongoDB/Atlas Search implementation (~2000 lines).
// Migrated 2026-03-09: all query logic is now handled by PostgresPrintingsService.

import { printingsService } from '@/lib/services';
import type { PrintingDTO, PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

export type PrintingDocument = PrintingDTO;

export class FABPrintingsSearchUtility {
  async searchPrintings(
    filters: PrintingsSearchFilters = {},
    options: PrintingsSearchOptions = {}
  ): Promise<{ printings: PrintingDTO[]; total: number; page: number; pages: number }> {
    const result = await printingsService.searchPrintings(filters, options);
    const data = result.success ? result.data : null;
    const printings = data?.printings ?? [];
    const limit = options.limit || 12;
    return {
      printings,
      total: data?.total ?? 0,
      page: data?.page ?? (options.page || 1),
      pages: data?.pages ?? 0,
    };
  }
}

// lib/client/csv-import-client.ts
// Print-code CSV import (partner contract, lib/import/print-code.ts).
import { handleResponse, handleError } from './utils';
import type { ApiResponse } from './types';
import type { PrintCodeImportRow } from '@/lib/import/print-code-import';

export type { PrintCodeImportRow };

export interface PrintCodeResolveResult {
  rows: PrintCodeImportRow[];
  parseErrors: string[];
}

/** Upload the CSV; get every row back resolved to a printing (nothing is written). */
export async function resolvePrintCodeCsv(file: File): Promise<ApiResponse<PrintCodeResolveResult>> {
  try {
    const fd = new FormData();
    fd.append('csv', file);
    const response = await fetch('/api/collection/csv-import/resolve', { method: 'POST', body: fd });
    return handleResponse<PrintCodeResolveResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

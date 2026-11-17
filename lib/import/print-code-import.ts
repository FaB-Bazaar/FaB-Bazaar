// lib/import/print-code-import.ts
// Joins parsed print-code CSV rows with their resolutions into the review rows
// the /browse import shows. Pure: no DB access.
//
// A wrong card added silently is the failure that matters, so a row is only
// 'ok' when its code names exactly one printing AND, if the file gave a name,
// that printing carries it. Otherwise 'not_sure' (the user confirms on /browse)
// or 'unresolved' (nothing to show).
import type { PrintCodeCsvRow } from './print-code';
import type { PrintCodeResolution, PrintingDTO } from '@/lib/services/contracts/IPrintingsService';

export interface PrintCodeImportRow extends PrintCodeCsvRow {
  status: 'ok' | 'not_sure' | 'unresolved';
  reason?: string;
  /** the matched printing; for not_sure, the best guess */
  printing?: PrintingDTO;
  /** ambiguous codes: every printing the code fits */
  candidates?: PrintingDTO[];
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*(?:\(\s*(?:red|yellow|blue)\s*\)|-\s*(?:red|yellow|blue))\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function namesMatch(name: string, printing: Pick<PrintingDTO, 'name'>): boolean {
  return normalizeName(name) === normalizeName(printing.name ?? '');
}

export function assemblePrintCodeImport(
  rows: PrintCodeCsvRow[],
  resolutions: PrintCodeResolution[],
): PrintCodeImportRow[] {
  return rows.map((row, i): PrintCodeImportRow => {
    const res = resolutions[i];

    if (!res || res.status === 'not_found') {
      return { ...row, status: 'unresolved', reason: 'No printing has this code.' };
    }

    if (res.status === 'ambiguous') {
      const candidates = res.candidates ?? [];
      const named = row.name ? candidates.filter(p => namesMatch(row.name, p)) : [];
      if (named.length === 1) return { ...row, status: 'ok', printing: named[0] };
      return {
        ...row,
        status: 'not_sure',
        reason: `This code fits ${candidates.length} printings — pick the right one.`,
        printing: (named[0] ?? candidates[0]),
        candidates,
      };
    }

    const printing = res.printing!;
    if (row.name && !namesMatch(row.name, printing)) {
      return {
        ...row,
        status: 'not_sure',
        reason: `The code is ${printing.name}, but the file says "${row.name}".`,
        printing,
      };
    }
    return { ...row, status: 'ok', printing };
  });
}

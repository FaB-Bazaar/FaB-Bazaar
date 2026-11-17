// app/api/printings/catalog/route.ts
// Public print-code catalog: every printing with the print_code the CSV import
// (/api/collection/csv-import/resolve) accepts for it. Partner tools join their
// own data on it to produce an import file. Card data only — no user data.
import { NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { getCatalogCsv } from '@/lib/import/print-code-catalog';

export async function GET() {
  const result = await getCatalogCsv(() => printingsService.listPrintCodeCatalog());
  if (!result.success) {
    return NextResponse.json({ error: 'Failed to build the catalog.' }, { status: 500 });
  }
  return new NextResponse(result.data, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fabbazaar-print-codes.csv"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// app/api/collection/csv-import/resolve/route.ts
// Print-code CSV import, step 1 (the partner contract — lib/import/print-code.ts):
// parse the upload and resolve every code to a printing. Writes nothing — the
// /browse page stages the rows and the user adds them to a binder they choose.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { printingsService } from '@/lib/services';
import { parsePrintCodeCsv } from '@/lib/import/print-code';
import { assemblePrintCodeImport, type PrintCodeImportRow } from '@/lib/import/print-code-import';

// A 5,000-row file is ~200 KB; anything near this is not a card list.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface PrintCodeResolveResponse {
  rows: PrintCodeImportRow[];
  parseErrors: string[];
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
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
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'The file is larger than 2 MB.' }, { status: 400 });
    }
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read uploaded file.' }, { status: 400 });
  }

  const { rows, errors } = parsePrintCodeCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? 'No rows with a quantity found in the CSV.' },
      { status: 400 },
    );
  }

  const resolved = await printingsService.resolvePrintCodes(rows.map(r => r.printCode));
  if (!resolved.success) {
    return NextResponse.json({ error: 'Failed to look up the print codes.' }, { status: 500 });
  }

  const data: PrintCodeResolveResponse = {
    rows: assemblePrintCodeImport(rows, resolved.data),
    parseErrors: errors,
  };
  return NextResponse.json({ success: true, data });
}

import { NextRequest, NextResponse } from "next/server";
import { printingsService } from "@/lib/services";

/**
 * GET /api/sets/[setCode]/languages
 *
 * Lists the distinct printing languages present in a set, English first.
 * Drives the language flag filter on /sets/[setCode] — the UI hides the
 * row for English-only sets. Public reference data (no auth), mirroring
 * /api/sets/[setCode]/packs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  const { setCode } = await params;

  const result = await printingsService.getSetLanguages(setCode);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

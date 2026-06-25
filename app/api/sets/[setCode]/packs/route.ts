import { NextRequest, NextResponse } from "next/server";
import { printingsService } from "@/lib/services";

/**
 * GET /api/sets/[setCode]/packs
 *
 * Lists the TCGplayer groups (sub-set packs) present in a set, ordered by
 * release — e.g. GEM's seasonal "GEM Pack N". Returns [] for ordinary
 * single-group sets, which lets the UI conditionally render a pack filter.
 * Public reference data (no auth), mirroring the printings search endpoint.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  const { setCode } = await params;

  const result = await printingsService.getSetGroups(setCode);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

import { NextRequest, NextResponse } from "next/server";
import { printingsService } from "@/lib/services";

/**
 * GET /api/cards/by-hero
 *
 * Public. Returns the hero's full legal card pool as slim CardSummaryDTO[]
 * — one row per unique card with a representative printing chosen server-side
 * by foiling priority. Used by the deck editor to ship the entire pool in a
 * single small fetch (~300 KB) instead of preloading 200 MB of printings per
 * type chip.
 *
 * Query params (all optional, all CSV where applicable):
 *   heroClasses    — e.g. "guardian,brute"
 *   heroTalents    — e.g. "light,earth"
 *   heroEssences   — e.g. "lightning"
 *   format         — e.g. "cc", "blitz"
 */
function parseCsv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const result = await printingsService.searchCardsForHero({
    heroClasses: parseCsv(searchParams.get("heroClasses")),
    heroTalents: parseCsv(searchParams.get("heroTalents")),
    heroEssences: parseCsv(searchParams.get("heroEssences")),
    format: searchParams.get("format") ?? undefined,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

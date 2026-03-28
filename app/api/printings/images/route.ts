// POST /api/printings/images
// Body: { cards: Array<{ cardId: string; cardName: string; pitchValue?: number }> }
// Returns: { images: { [cardId]: imageUrl } }
// Fetches card images for opponent cards. All lookups run concurrently via Promise.all.
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';

const MAX_CARDS = 200;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input: Array<{ cardId: string; cardName: string; pitchValue?: number }> = body?.cards ?? [];

  if (!Array.isArray(input) || input.length === 0) {
    return NextResponse.json({ images: {} });
  }

  // Deduplicate by cardId
  const unique = input
    .slice(0, MAX_CARDS)
    .filter((c, i, arr) => c.cardId && c.cardName && arr.findIndex(x => x.cardId === c.cardId) === i);

  if (unique.length === 0) return NextResponse.json({ images: {} });

  const entries = await Promise.all(
    unique.map(async ({ cardId, cardName, pitchValue }) => {
      const filters: Record<string, unknown> = { name: cardName, exact: true };
      if (pitchValue != null && pitchValue > 0) filters.pitch = pitchValue;

      const result = await printingsService.searchPrintings(
        filters as Parameters<typeof printingsService.searchPrintings>[0],
        { limit: 1, sortBy: 'set', sortOrder: 'asc', show: 'all' }
      );
      if (result.success && result.data.printings?.[0]?.image_url) {
        return [cardId, result.data.printings[0].image_url] as const;
      }
      return null;
    })
  );

  const images = Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
  return NextResponse.json({ images });
}

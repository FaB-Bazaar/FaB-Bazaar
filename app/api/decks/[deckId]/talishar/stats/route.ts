import { NextRequest, NextResponse } from 'next/server';
import { gameResultsService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const resolvedParams = await params;
    const result = await gameResultsService.getGameResultsForDeck(resolvedParams.deckId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Talishar Stats] Error fetching game results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

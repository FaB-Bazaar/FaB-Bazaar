// app/api/users/autocomplete/route.ts
// Read-only username autocomplete for co-owner management.
// Requires authentication + a valid deckId the caller owns.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService, deckService } from '@/lib/services';
import { displayUsername } from '@/lib/utils/display-username';

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 8;

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const deckId = searchParams.get('deckId')?.trim() ?? '';

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ success: true, users: [] });
    }

    // Verify the caller owns the specified deck (not just a co-owner)
    if (!deckId) {
      return NextResponse.json({ success: false, error: 'deckId is required' }, { status: 400 });
    }

    const deckLookup = await deckService.findByPublicId(deckId);
    if (!deckLookup.success || !deckLookup.data || deckLookup.data.userId !== authResult.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchResult = await userService.searchUsers(query, MAX_RESULTS);
    if (!searchResult.success) {
      return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
    }

    // Exclude the deck owner themselves from results
    const users = searchResult.data
      .filter(u => u._id !== authResult.userId)
      .map(u => ({
        id: u._id,
        username: displayUsername(u.username ?? ''),
        avatar: u.avatarUrl ?? null,
      }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[UserAutocomplete] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const body = await request.json();

    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { featured } = body;
    if (typeof featured !== 'boolean') {
      return NextResponse.json({ success: false, error: 'featured must be a boolean' }, { status: 400 });
    }

    // Check roles
    const [curatorCheck, adminCheck] = await Promise.all([
      userService.hasRole(authResult.userId!, 'isCurator'),
      userService.hasRole(authResult.userId!, 'isSuperAdmin'),
    ]);
    const isCurator = !!(curatorCheck.success && curatorCheck.data);
    const isSuperAdmin = !!(adminCheck.success && adminCheck.data);

    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    // Fetch the deck to validate
    const deckResult = await deckService.findByPublicId(deckId);
    if (!deckResult.success || !deckResult.data) {
      return NextResponse.json({ success: false, error: 'Deck not found' }, { status: 404 });
    }

    // Curators can only feature their own decks; superadmins can feature any deck
    if (isCurator && !isSuperAdmin && deckResult.data.userId !== authResult.userId) {
      return NextResponse.json({ success: false, error: 'You can only feature your own decks' }, { status: 403 });
    }

    // Deck must be public to be featured
    if (featured && deckResult.data.visibility !== 'public') {
      return NextResponse.json({ success: false, error: 'Deck must be public to be featured' }, { status: 400 });
    }

    const result = await deckService.toggleFeatured(deckId, featured);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { featured } });
  } catch (error) {
    console.error('[DeckFeatured] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

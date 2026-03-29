import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const authResult = await authenticateRequest(req, {});
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get and validate the search query
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query || query.length < 3) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'Search query must be at least 3 characters long.'
      });
    }

    // 3. Use service layer to search for cards
    const result = await binderService.searchUserCards(authResult.userId, query, 50);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      results: result.data
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
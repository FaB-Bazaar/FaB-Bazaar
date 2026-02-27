//app/api/whowants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { wantsService } from '@/lib/services';
import type { WhoWantsFilters } from '@/lib/services/contracts/IWantsService';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const printingIdsParam = url.searchParams.get('printingIds');
    const cardUniqueIdsParam = url.searchParams.get('cardUniqueIds');
    const country = url.searchParams.get('country');
    const state = url.searchParams.get('state');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const sortBy = (url.searchParams.get('sortBy') || 'username') as WhoWantsFilters['sortBy'];

    // Validate that exactly one search type is provided
    if (!printingIdsParam && !cardUniqueIdsParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: either printingIds or cardUniqueIds',
        },
        { status: 400 }
      );
    }

    if (printingIdsParam && cardUniqueIdsParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot specify both printingIds and cardUniqueIds - choose one',
        },
        { status: 400 }
      );
    }

    // Parse the appropriate parameter
    let searchIds: string[] = [];
    let searchMode: 'specific_printings' | 'all_versions' = 'specific_printings';

    if (printingIdsParam) {
      searchIds = printingIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      searchMode = 'specific_printings';
    } else if (cardUniqueIdsParam) {
      searchIds = cardUniqueIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      searchMode = 'all_versions';
    }

    // Validate ID count (service also validates, but we want a 400 not 500)
    if (searchIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid IDs provided' },
        { status: 400 }
      );
    }
    if (searchIds.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Too many IDs (max 20)' },
        { status: 400 }
      );
    }

    // Build filters
    const filters: WhoWantsFilters = {
      country: country || undefined,
      state: state || undefined,
      sortBy,
    };

    // Pagination options
    const options = {
      skip: (page - 1) * limit,
      limit,
    };

    // Call service based on search mode
    const result =
      searchMode === 'specific_printings'
        ? await wantsService.getWhoWantsPrintings(searchIds, filters, options)
        : await wantsService.getWhoWantsCards(searchIds, filters, options);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    console.error('Error in /api/whowants:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

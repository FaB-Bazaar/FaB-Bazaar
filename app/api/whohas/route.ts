//app/api/whohas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { inventoryService, userService } from '@/lib/services';
import type { WhoHasFilters } from '@/lib/services/contracts/IInventoryService';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const printingIdsParam = url.searchParams.get('printingIds');
    const cardUniqueIdsParam = url.searchParams.get('cardUniqueIds');
    const includeForTradeOnly = url.searchParams.get('forTradeOnly') === 'true';
    const minCondition = url.searchParams.get('minCondition') as WhoHasFilters['minCondition'];
    const country = url.searchParams.get('country');
    const state = url.searchParams.get('state');
    const followedStoresOnly = url.searchParams.get('followedStoresOnly') === 'true';
    const activeWithinDaysParam = url.searchParams.get('activeWithinDays');
    const activeWithinDays = activeWithinDaysParam === '0'
      ? undefined
      : (activeWithinDaysParam ? parseInt(activeWithinDaysParam) : 90);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

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

    // Handle followed stores auth (keep auth in route layer)
    let followedStoreIds: string[] | undefined;
    if (followedStoresOnly) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required for followed stores filtering',
          },
          { status: 401 }
        );
      }

      // Look up user's followed stores via service
      const followedStoresResult = await userService.getFollowedStores(session.user.id);
      if (followedStoresResult.success) {
        followedStoreIds = followedStoresResult.data;
        // If user has no followed stores, return empty results
        if (followedStoreIds.length === 0) {
          followedStoreIds = [];
        }
      } else {
        // If service call fails, treat as no followed stores
        followedStoreIds = [];
      }
    }

    // Build filters
    const filters: WhoHasFilters = {
      forTradeOnly: includeForTradeOnly,
      minCondition: minCondition || undefined,
      country: country || undefined,
      state: state || undefined,
      followedStoreIds,
      activeWithinDays,
    };

    // Pagination options
    const options = {
      skip: (page - 1) * limit,
      limit,
    };

    // Call service based on search mode
    const result =
      searchMode === 'specific_printings'
        ? await inventoryService.getWhoHasPrintings(searchIds, filters, options)
        : await inventoryService.getWhoHasCards(searchIds, filters, options);

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
  } catch (err: any) {
    console.error('[WhoHas] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to find card owners',
      },
      { status: 500 }
    );
  }
}

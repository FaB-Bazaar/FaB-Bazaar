// app/api/search/core/route.ts
// ⚠️ MIGRATED: Now uses PostgreSQL printingsService instead of MongoDB printings_core
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract search parameters
    const filters: PrintingsSearchFilters = {};
    const options: PrintingsSearchOptions = {};

    // Text searches
    if (searchParams.get('name')) filters.name = searchParams.get('name')!;
    if (searchParams.get('exact')) filters.exact = searchParams.get('exact') === 'true';

    // Identifiers (most important for core searches)
    if (searchParams.get('cardUniqueId')) filters.cardUniqueId = searchParams.get('cardUniqueId')!;
    if (searchParams.get('cardUniqueIds')) filters.cardUniqueIds = searchParams.get('cardUniqueIds')!.split(',');
    if (searchParams.get('printingId')) {
      filters.printingIds = [searchParams.get('printingId')!];
    }
    if (searchParams.get('printingIds')) {
      filters.printingIds = searchParams.get('printingIds')!.split(',');
    }

    // Printing attributes
    if (searchParams.get('sets')) filters.sets = searchParams.get('sets')!.split(',');
    // TCGplayer group ids (sub-set packs, e.g. GEM Pack N). Comma-separated ints.
    if (searchParams.get('tcgGroup')) {
      const ids = searchParams.get('tcgGroup')!.split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (ids.length > 0) filters.tcgGroupIds = ids;
    }
    if (searchParams.get('editions')) filters.editions = searchParams.get('editions')!.split(',');
    if (searchParams.get('foilings')) filters.foilings = searchParams.get('foilings')!.split(',');
    if (searchParams.get('rarities')) filters.rarities = searchParams.get('rarities')!.split(',');
    if (searchParams.get('isExtendedArt')) filters.isExtendedArt = searchParams.get('isExtendedArt') === 'true';

    // Price filters
    if (searchParams.get('priceMin')) filters.priceMin = parseFloat(searchParams.get('priceMin')!);
    if (searchParams.get('priceMax')) filters.priceMax = parseFloat(searchParams.get('priceMax')!);
    if (searchParams.get('priceField')) filters.priceField = searchParams.get('priceField') as any;
    if (searchParams.get('hasPricing')) filters.hasPricing = searchParams.get('hasPricing') === 'true';

    // Options
    if (searchParams.get('limit')) options.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('page')) options.page = parseInt(searchParams.get('page')!);
    if (searchParams.get('sortBy')) options.sortBy = searchParams.get('sortBy') as any;
    if (searchParams.get('sortOrder')) options.sortOrder = searchParams.get('sortOrder') as any;

    // Execute search using PostgreSQL printingsService
    const result = await printingsService.searchPrintings(filters, options);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Return results (debug info only in development)
    const response: any = {
      success: true,
      data: result.data,
    };

    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        parsedFilters: filters,
        parsedOptions: options,
        executionTime: result.data.queryInfo?.executionTime,
        database: 'PostgreSQL'
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Core search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search failed'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { filters = {}, options = {} } = body;

    // Log the incoming request for debugging
    console.log('[Core Search API] Received filters:', JSON.stringify(filters));
    console.log('[Core Search API] Received options:', JSON.stringify(options));

    // Execute search using PostgreSQL printingsService
    const result = await printingsService.searchPrintings(filters, options);

    if (!result.success) {
      console.error('[Core Search API] Service error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    const executionTime = Date.now() - startTime;

    // Log the results for debugging
    console.log('[Core Search API] Query execution time:', executionTime, 'ms');
    console.log('[Core Search API] Total results found:', result.data.total);

    // Format response to match the existing API structure
    const response: any = {
      success: true,
      data: result.data,
    };

    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        executionTime: result.data.queryInfo?.executionTime,
        totalExecutionTime: executionTime,
        receivedFilters: filters,
        receivedOptions: options,
        database: 'PostgreSQL'
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Core Search API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed'
      },
      { status: 500 }
    );
  }
}
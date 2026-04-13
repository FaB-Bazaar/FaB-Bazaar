// app/api/printings/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { printingsService } from '@/lib/services';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';
import { TalentUtils } from '@/lib/talent-constants';
import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
import { authenticateRequest, hasAuthParams } from '@/lib/auth/multi-auth';
import { getRedisClient } from '@/lib/redis';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { sql } from 'drizzle-orm';

const shorthandParser = new FABShorthandParser();

function sortedKeys<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  ) as T;
}

function buildSearchCacheKey(filters: PrintingsSearchFilters, options: PrintingsSearchOptions): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ filters: sortedKeys(filters), options: sortedKeys(options) }))
    .digest('hex')
    .slice(0, 16);
  return `search:${hash}`;
}

export async function GET(request: NextRequest) {
  try {
    // Short-circuit auth check for public requests (avoid DB overhead)
    let authResult = null;
    if (hasAuthParams(request, {})) {
      authResult = await authenticateRequest(request, {});
      if (authResult.success && authResult.userId) {
        console.log(`[Printings Search] Authenticated request from ${authResult.username} via ${authResult.authMethod}`);
      }
    }

    const { searchParams } = new URL(request.url);

    // Shorthand query support: ?q=hero:uzuri cost:0,1 p:<10 bash brute
    // When `q` is provided, parse it with the shorthand parser and merge with explicit params
    const shorthandQuery = searchParams.get('q');
    let parsedShorthand: { filters: PrintingsSearchFilters; parsedTokens: string[] } | null = null;

    if (shorthandQuery) {
      parsedShorthand = shorthandParser.parseQuery(shorthandQuery);
    }

    // Extract search parameters (explicit params override shorthand)
    const filters: PrintingsSearchFilters = parsedShorthand ? { ...parsedShorthand.filters } : {};
    const options: PrintingsSearchOptions = {};

    // Text searches
    if (searchParams.get('name')) filters.name = searchParams.get('name')!;
    if (searchParams.get('text')) filters.text = searchParams.get('text')!;
    if (searchParams.get('searchableText')) filters.searchableText = searchParams.get('searchableText')!;
    if (searchParams.get('exact')) filters.exact = searchParams.get('exact') === 'true';
    
    // Card attributes
    if (searchParams.get('types')) filters.types = searchParams.get('types')!.split(',');
    if (searchParams.get('classes')) filters.classes = searchParams.get('classes')!.split(',');
    if (searchParams.get('keywords')) filters.keywords = searchParams.get('keywords')!.split(',');
    if (searchParams.get('colors')) filters.colors = searchParams.get('colors')!.split(',');
    // Backward compatibility: support singular 'color' param
    if (searchParams.get('color') && !searchParams.get('colors')) {
      filters.colors = [searchParams.get('color')!];
    }

    // Card ID filters
    if (searchParams.get('cardUniqueId')) filters.cardUniqueId = searchParams.get('cardUniqueId')!;
    if (searchParams.get('cardUniqueIds')) filters.cardUniqueIds = searchParams.get('cardUniqueIds')!.split(',');
    if (searchParams.get('collectorNumber')) {
      const ids = searchParams.get('collectorNumber')!.split(',');
      filters.collectorNumber = ids.length === 1 ? ids[0] : ids;
    }
    
    // ✅ SMART TALENT CONVERSION (REPLACE the old talent lines)
    if (searchParams.get('talents')) {
      const talents = searchParams.get('talents')!.split(',').map(t => t.trim());
      const talentFilters = TalentUtils.convertTalentsToFilters(talents, false);
      Object.assign(filters, talentFilters);
    }

    // TALENT EXCLUSIONS  
    if (searchParams.get('talentsNot')) {
      const excludedTalents = searchParams.get('talentsNot')!.split(',').map(t => t.trim());
      const exclusionFilters = TalentUtils.convertTalentsToFilters(excludedTalents, true);
      Object.assign(filters, exclusionFilters);
    }
    
    // Printing attributes
    if (searchParams.get('sets')) filters.sets = searchParams.get('sets')!.split(',');
    if (searchParams.get('editions')) filters.editions = searchParams.get('editions')!.split(',');
    if (searchParams.get('foilings')) filters.foilings = searchParams.get('foilings')!.split(',');
    if (searchParams.get('rarities')) filters.rarities = searchParams.get('rarities')!.split(',');
    if (searchParams.get('raritiesNot')) filters.raritiesNot = searchParams.get('raritiesNot')!.split(',');

    // Price filters
    if (searchParams.get('priceMin')) filters.priceMin = parseFloat(searchParams.get('priceMin')!);
    if (searchParams.get('priceMax')) filters.priceMax = parseFloat(searchParams.get('priceMax')!);
    if (searchParams.get('priceField')) filters.priceField = searchParams.get('priceField') as any;
    
    // Boolean filters - Card Types
    if (searchParams.get('isAction')) filters.isAction = searchParams.get('isAction') === 'true';
    if (searchParams.get('isAttack')) filters.isAttack = searchParams.get('isAttack') === 'true';
    if (searchParams.get('isDefenseReaction')) filters.isDefenseReaction = searchParams.get('isDefenseReaction') === 'true';
    if (searchParams.get('isInstant')) filters.isInstant = searchParams.get('isInstant') === 'true';
    if (searchParams.get('isEquipment')) filters.isEquipment = searchParams.get('isEquipment') === 'true';
    if (searchParams.get('isWeapon')) filters.isWeapon = searchParams.get('isWeapon') === 'true';
    if (searchParams.get('isHero')) filters.isHero = searchParams.get('isHero') === 'true';
    
    // Boolean filters - Classes
    if (searchParams.get('isGuardian')) filters.isGuardian = searchParams.get('isGuardian') === 'true';
    if (searchParams.get('isRuneblade')) filters.isRuneblade = searchParams.get('isRuneblade') === 'true';
    if (searchParams.get('isNecromancer')) filters.isNecromancer = searchParams.get('isNecromancer') === 'true';
    if (searchParams.get('isBrute')) filters.isBrute = searchParams.get('isBrute') === 'true';
    if (searchParams.get('isWarrior')) filters.isWarrior = searchParams.get('isWarrior') === 'true';
    if (searchParams.get('isNinja')) filters.isNinja = searchParams.get('isNinja') === 'true';
    if (searchParams.get('isWizard')) filters.isWizard = searchParams.get('isWizard') === 'true';
    if (searchParams.get('isMechanologist')) filters.isMechanologist = searchParams.get('isMechanologist') === 'true';
    if (searchParams.get('isRanger')) filters.isRanger = searchParams.get('isRanger') === 'true';
    
    // ✅ OPTIONAL: Keep individual boolean overrides for power users (these will override the converted values)
    if (searchParams.get('hasElemental')) filters.hasElemental = searchParams.get('hasElemental') === 'true';
    if (searchParams.get('hasEarth')) filters.hasEarth = searchParams.get('hasEarth') === 'true';
    if (searchParams.get('hasIce')) filters.hasIce = searchParams.get('hasIce') === 'true';
    if (searchParams.get('hasLightning')) filters.hasLightning = searchParams.get('hasLightning') === 'true';
    if (searchParams.get('hasLight')) filters.hasLight = searchParams.get('hasLight') === 'true';
    if (searchParams.get('hasPirate')) filters.hasPirate = searchParams.get('hasPirate') === 'true';
    if (searchParams.get('hasShadow')) filters.hasShadow = searchParams.get('hasShadow') === 'true';
    if (searchParams.get('hasRoyal')) filters.hasRoyal = searchParams.get('hasRoyal') === 'true';
    if (searchParams.get('hasDraconic')) filters.hasDraconic = searchParams.get('hasDraconic') === 'true';
    if (searchParams.get('hasChaos')) filters.hasChaos = searchParams.get('hasChaos') === 'true'; // ✅ ADD THIS - you were missing chaos and mystic
    if (searchParams.get('hasMystic')) filters.hasMystic = searchParams.get('hasMystic') === 'true'; // ✅ ADD THIS
    
    // Boolean filters - Combinations
    if (searchParams.get('isGenericOnly')) filters.isGenericOnly = searchParams.get('isGenericOnly') === 'true';
    if (searchParams.get('hasClassAndTalent')) filters.hasClassAndTalent = searchParams.get('hasClassAndTalent') === 'true';
    if (searchParams.get('hasClassOnly')) filters.hasClassOnly = searchParams.get('hasClassOnly') === 'true';
    if (searchParams.get('hasTalentOnly')) filters.hasTalentOnly = searchParams.get('hasTalentOnly') === 'true';
    
    // Foiling filters
    if (searchParams.get('isRainbowFoil')) filters.isRainbowFoil = searchParams.get('isRainbowFoil') === 'true';
    if (searchParams.get('isColdFoil')) filters.isColdFoil = searchParams.get('isColdFoil') === 'true';
    if (searchParams.get('isNormalFoil')) filters.isNormalFoil = searchParams.get('isNormalFoil') === 'true';
    if (searchParams.get('isExtendedArt')) filters.isExtendedArt = searchParams.get('isExtendedArt') === 'true';
    
    // Rarity filters
    if (searchParams.get('isCommon')) filters.isCommon = searchParams.get('isCommon') === 'true';
    if (searchParams.get('isRare')) filters.isRare = searchParams.get('isRare') === 'true';
    if (searchParams.get('isMajestic')) filters.isMajestic = searchParams.get('isMajestic') === 'true';
    if (searchParams.get('isLegendary')) filters.isLegendary = searchParams.get('isLegendary') === 'true';
    if (searchParams.get('isFabled')) filters.isFabled = searchParams.get('isFabled') === 'true';
    
    // Price filters
    if (searchParams.get('isBudget')) filters.isBudget = searchParams.get('isBudget') === 'true';
    if (searchParams.get('isUnder5')) filters.isUnder5 = searchParams.get('isUnder5') === 'true';
    if (searchParams.get('isUnder10')) filters.isUnder10 = searchParams.get('isUnder10') === 'true';
    if (searchParams.get('isUnder25')) filters.isUnder25 = searchParams.get('isUnder25') === 'true';
    if (searchParams.get('isUnder50')) filters.isUnder50 = searchParams.get('isUnder50') === 'true';
    if (searchParams.get('isUnder100')) filters.isUnder100 = searchParams.get('isUnder100') === 'true';
    if (searchParams.get('isExpensive')) filters.isExpensive = searchParams.get('isExpensive') === 'true';
    
    // Hero-based filtering (precise mode — card.classes ⊆ heroClasses AND card.talents ⊆ heroTalents)
    if (searchParams.get('heroClasses')) filters.heroClasses = searchParams.get('heroClasses')!.split(',').map(s => s.trim()).filter(Boolean);
    if (searchParams.get('heroTalents')) filters.heroTalents = searchParams.get('heroTalents')!.split(',').map(s => s.trim()).filter(Boolean);
    if (searchParams.get('heroEssences')) filters.heroEssences = searchParams.get('heroEssences')!.split(',').map(s => s.trim()).filter(Boolean);
    // Legacy hero filtering (single hero name string — less precise, kept for backwards compat)
    if (searchParams.get('heroLegal')) filters.heroLegal = searchParams.get('heroLegal')!;

    // Pitch filter (1 = red, 2 = yellow, 3 = blue, null = unpitched)
    if (searchParams.get('pitch')) {
      const p = searchParams.get('pitch')!;
      filters.pitch = p === 'null' ? null : parseInt(p, 10);
    }
    
    // Format legality
    if (searchParams.get('format')) filters.format = searchParams.get('format') as any;
    if (searchParams.get('includeBanned')) filters.includeBanned = searchParams.get('includeBanned') === 'true';
    
    // Options
    if (searchParams.get('limit')) options.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('page')) options.page = parseInt(searchParams.get('page')!);
    if (searchParams.get('sortBy')) options.sortBy = searchParams.get('sortBy') as any;
    if (searchParams.get('sortOrder')) options.sortOrder = searchParams.get('sortOrder') as any;
    if (searchParams.get('show')) options.show = searchParams.get('show') as any;
    if (searchParams.get('searchMode')) options.searchMode = searchParams.get('searchMode') as any;
    
    // In your API route, add this after the existing printingIds handling:
    if (searchParams.get('printingId')) {
      // Handle singular printing ID
      filters.printingIds = [searchParams.get('printingId')!];
    }

    if (searchParams.get('printingIds')) {
      // Handle comma-separated printing IDs  
      filters.printingIds = searchParams.get('printingIds')!.split(',');
    }
    
    // Execute search using service layer
    const result = await printingsService.searchPrintings(filters, options);

    // Handle service errors
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Return results - only include debug info in development
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({
      success: true,
      data: result.data,
      ...(isDev && {
        debug: {
          parsedFilters: filters,
          parsedOptions: options,
          ...(parsedShorthand && { parsedTokens: parsedShorthand.parsedTokens }),
          executionTime: result.data.queryInfo?.executionTime
        }
      })
    });

  } catch (error) {
    console.error('Search test error:', error);
    // Don't expose stack traces publicly
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Short-circuit auth check for public requests (avoid DB overhead)
    let authResult = null;
    if (hasAuthParams(request, body)) {
      authResult = await authenticateRequest(request, body);
      if (authResult.success && authResult.userId) {
        console.log(`[Printings Search] Authenticated POST request from ${authResult.username} via ${authResult.authMethod}`);
      }
    }

    const { filters = {}, options = {} } = body;


    // Fetch current price version (MAX price_updated_at) to detect stale cache
    let currentPriceVersion = 'unknown';
    try {
      const [{ maxTs }] = await db
        .select({ maxTs: sql<string>`MAX(price_updated_at)::text` })
        .from(printings);
      currentPriceVersion = maxTs ?? 'unknown';
    } catch (err) {
      console.error('[Printings Search POST] Price version query error:', err);
    }

    // Try Redis cache first
    const cacheKey = buildSearchCacheKey(filters, options);
    const redis = getRedisClient();
    let searchData = null;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          const parsed = JSON.parse(cached);
          if (parsed._priceVersion === currentPriceVersion) {
            searchData = parsed; // Fresh — use cache
          }
          // else: stale prices — fall through to DB query
        }
      } catch (err) {
        console.error('[Printings Search POST] Cache read error:', err);
      }
    }


    if (searchData === null) {
      // Cache miss — query the database
      const result = await printingsService.searchPrintings(filters, options);
      if (!result.success) {
        console.error('[Printings Search POST] Service error:', result.error);
        console.error('[Printings Search POST] Filters:', JSON.stringify(filters, null, 2));
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      searchData = result.data;

      // Cache only non-empty results (empty results may be transient)
      if (redis && searchData.total > 0) {
        try {
          await redis.set(
            cacheKey,
            JSON.stringify({ ...searchData, _priceVersion: currentPriceVersion }),
            'EX',
            86400
          );
        } catch (err) {
          console.error('[Printings Search POST] Cache write error:', err);
        }
      }
    }

    // Return results - only include debug info in development
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({
      success: true,
      data: searchData,
      ...(isDev && {
        debug: {
          receivedFilters: filters,
          receivedOptions: options,
          cacheKey,
        }
      })
    });

  } catch (error) {
    console.error('[Printings Search POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
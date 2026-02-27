// app/api/hero-printings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') as 'young' | 'adult' | undefined;
    const classFilter = searchParams.get('class')?.toLowerCase();
    const talentFilter = searchParams.get('talent')?.toLowerCase();
    const search = searchParams.get('search')?.toLowerCase();

    // Step 1: Filter heroes from constants based on format
    let heroesSource = format === 'young'
      ? Object.entries(YOUNG_HERO_INFO)
      : format === 'adult'
      ? Object.entries(HERO_INFO)
      : [...Object.entries(HERO_INFO), ...Object.entries(YOUNG_HERO_INFO)];

    // Step 2: Apply filters in-memory
    const filteredHeroes = heroesSource.filter(([heroName, heroInfo]) => {
      // Class filter
      if (classFilter && !heroInfo.classes.some(c => c.toLowerCase() === classFilter)) {
        return false;
      }

      // Talent filter
      if (talentFilter && !heroInfo.talents.some(t => t.toLowerCase() === talentFilter)) {
        return false;
      }

      // Search filter (match against hero name or shortName)
      if (search && !heroName.toLowerCase().includes(search) && !heroInfo.shortName.toLowerCase().includes(search)) {
        return false;
      }

      return true;
    });

    // Step 3: Get cardUniqueIds and fetch printings from DB
    const cardUniqueIds = filteredHeroes.map(([_, info]) => info.cardUniqueId).filter(Boolean);

    if (cardUniqueIds.length === 0) {
      return NextResponse.json({
        success: true,
        heroes: [],
        count: 0,
      });
    }

    // Fetch printings for these heroes (just to get image_url and primary printing)
    const heroes = await Promise.all(
      filteredHeroes.map(async ([heroName, heroInfo]) => {
        if (!heroInfo.cardUniqueId) {
          return null;
        }

        // Get primary printing for this hero
        const result = await printingsService.searchPrintings(
          { cardUniqueId: heroInfo.cardUniqueId },
          { limit: 1 }
        );

        if (!result.success || result.data.printings.length === 0) {
          return null;
        }

        const primary = result.data.printings[0];

        return {
          _id: primary._id,
          heroSlug: heroInfo.shortName,
          name: heroName,
          display_name: heroName,
          health: primary.health,
          intellect: primary.intellect,
          classes: heroInfo.classes,
          talents: heroInfo.talents,
          image_url: primary.image_url,
          is_young: format === 'young' || Object.keys(YOUNG_HERO_INFO).includes(heroName),
          primary_printing_id: primary.printing_id,
        };
      })
    );

    // Filter out null results
    const validHeroes = heroes.filter(h => h !== null);

    return NextResponse.json({
      success: true,
      heroes: validHeroes,
      count: validHeroes.length,
    });

  } catch (error) {
    console.error('[Hero Printings] Error fetching heroes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

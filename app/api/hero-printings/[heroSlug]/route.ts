// app/api/hero-printings/[heroSlug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ heroSlug: string }> }
) {
  try {
    const { heroSlug } = await params;

    // Step 1: Find hero in constants by matching shortName
    let heroEntry = Object.entries(HERO_INFO).find(([_, info]) =>
      info.shortName.toLowerCase() === heroSlug.toLowerCase()
    );

    let isYoung = false;
    if (!heroEntry) {
      heroEntry = Object.entries(YOUNG_HERO_INFO).find(([_, info]) =>
        info.shortName.toLowerCase() === heroSlug.toLowerCase()
      );
      isYoung = true;
    }

    if (!heroEntry) {
      return NextResponse.json(
        { error: 'Hero not found' },
        { status: 404 }
      );
    }

    const [heroName, heroInfo] = heroEntry;

    if (!heroInfo.cardUniqueId) {
      return NextResponse.json(
        { error: 'Hero not found' },
        { status: 404 }
      );
    }

    // Step 2: Fetch all printings for this hero using cardUniqueId
    const result = await printingsService.searchPrintings(
      { cardUniqueId: heroInfo.cardUniqueId },
      { limit: 10 }
    );

    if (!result.success || result.data.printings.length === 0) {
      return NextResponse.json(
        { error: 'Hero printings not found' },
        { status: 404 }
      );
    }

    // Use first printing as primary
    const primary = result.data.printings[0];

    return NextResponse.json({
      success: true,
      hero: {
        _id: primary._id,
        heroSlug: heroInfo.shortName,
        name: heroName,
        display_name: heroName,
        health: primary.health,
        intellect: primary.intellect,
        classes: heroInfo.classes,
        talents: heroInfo.talents,
        image_url: primary.image_url,
        is_young: isYoung,
        primary_printing_id: primary.printing_id,
        printings: result.data.printings.map(p => ({
          printing_id: p.printing_id,
          set: p.set,
          edition: p.edition,
          foiling: p.foiling,
          rarity: p.rarity,
          image_url: p.image_url,
          tcg_market: p.tcg_market,
        })),
      },
    });

  } catch (error) {
    console.error('[Hero Printings] Error fetching hero:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// app/api/hero-printings/route.ts
// Representative hero card printings (name + image + stats) for a hero age
// bracket. Resolved through ONE batched service call — this endpoint used to
// fan out one searchPrintings query per hero (117 across adult+young), which
// made every deck-presenter load block for seconds on it.
import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes';

// Hero rosters and their representative printings change on set releases, not
// per-request. Let browsers reuse for 30min and CDN/proxy for 1h.
const CACHE_CONTROL = 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') as 'young' | 'adult' | undefined;
    const classFilter = searchParams.get('class')?.toLowerCase();
    const talentFilter = searchParams.get('talent')?.toLowerCase();
    const search = searchParams.get('search')?.toLowerCase();

    // Step 1: Filter heroes from constants based on format
    const heroesSource = format === 'young'
      ? Object.entries(YOUNG_HERO_INFO)
      : format === 'adult'
      ? Object.entries(HERO_INFO)
      : [...Object.entries(HERO_INFO), ...Object.entries(YOUNG_HERO_INFO)];

    // Step 2: Apply filters in-memory
    const filteredHeroes = heroesSource.filter(([heroName, heroInfo]) => {
      if (classFilter && !heroInfo.classes.some(c => c.toLowerCase() === classFilter)) {
        return false;
      }
      if (talentFilter && !heroInfo.talents.some(t => t.toLowerCase() === talentFilter)) {
        return false;
      }
      if (search && !heroName.toLowerCase().includes(search) && !heroInfo.shortName.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    const withIds = filteredHeroes.filter(([, info]) => Boolean(info.cardUniqueId));
    const cardUniqueIds = withIds.map(([, info]) => info.cardUniqueId!);

    if (cardUniqueIds.length === 0) {
      return NextResponse.json(
        { success: true, heroes: [], count: 0 },
        { headers: { 'Cache-Control': CACHE_CONTROL } }
      );
    }

    // Step 3: ONE batched lookup — one representative printing per hero card
    const result = await printingsService.getCardSummariesByUniqueIds(cardUniqueIds);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    const summaryById = new Map(result.data.map(s => [s.cardUniqueId, s]));

    const validHeroes = withIds.flatMap(([heroName, heroInfo]) => {
      const summary = summaryById.get(heroInfo.cardUniqueId!);
      if (!summary) return [];
      return [{
        _id: summary.representativePrintingId,
        heroSlug: heroInfo.shortName,
        name: heroName,
        display_name: heroName,
        health: summary.health,
        intellect: summary.intelligence,
        classes: heroInfo.classes,
        talents: heroInfo.talents,
        image_url: summary.representativeImageUrl,
        is_young: format === 'young' || Object.keys(YOUNG_HERO_INFO).includes(heroName),
        primary_printing_id: summary.representativePrintingId,
      }];
    });

    return NextResponse.json(
      { success: true, heroes: validHeroes, count: validHeroes.length },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  } catch (error) {
    console.error('[Hero Printings] Error fetching heroes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

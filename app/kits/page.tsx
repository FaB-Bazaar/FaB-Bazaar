import { unstable_cache } from 'next/cache';
import { curatedListService, printingsService } from '@/lib/services';
import type { CuratedListDTO, HeroKitSummaryDTO } from '@/lib/services/contracts/ICuratedListService';

// Prices refresh nightly; aggregate is invalidated via `revalidateTag('kits-summary')`
// from the nightly price-refresh webhook and from admin kit CRUD routes.
const getCachedHeroSummaries = unstable_cache(
  async (format: string): Promise<HeroKitSummaryDTO[]> => {
    const result = await curatedListService.getHeroSummaries(format);
    return result.success ? result.data : [];
  },
  ['kits-hero-summaries'],
  { tags: ['kits-summary'] }
);
import {
  getHeroInfo,
  toHeroDisplayName,
  getLivingLegendPoints,
  getHeroMarvelImageUrl,
  LIVING_LEGEND_POINTS,
  LIVING_LEGEND_THRESHOLD,
  LIVING_LEGEND_POINTS_UPDATED_AT,
  LIVING_LEGEND_POINTS_SOURCE_LABEL,
} from '@/lib/fab-constants/heroes';
import { FORMAT_SLUG_TO_NAME, heroNameToSlug, formatToSlug } from '@/lib/utils/kit-slugs';
import KitsFormatTabs from '@/components/kits/KitsFormatTabs';
import KitsViewToggle from '@/components/kits/KitsViewToggle';
import KitPoolView from '@/components/kits/KitPoolView';
import HeroRosterTile from '@/components/kits/HeroRosterTile';

interface SearchParams {
  searchParams: Promise<{ format?: string; view?: string }>;
}

interface HeroSummary {
  heroName: string;
  displayName: string;
  className: string;
  talents: string[];
  kitCount: number;
  imageUrl?: string;
  health?: number;
  intelligence?: number;
  livingLegendPoints?: number;
  totalTcgLow?: number;
  graduated?: boolean;
}

export default async function KitsIndexPage({ searchParams }: SearchParams) {
  const { format: formatParam, view: viewParam } = await searchParams;
  const selectedFormat = formatParam && FORMAT_SLUG_TO_NAME[formatParam.toLowerCase()]
    ? FORMAT_SLUG_TO_NAME[formatParam.toLowerCase()]
    : 'Classic Constructed';
  const selectedSlug = formatToSlug(selectedFormat) ?? 'cc';
  const view: 'heroes' | 'pool' = viewParam === 'pool' ? 'pool' : 'heroes';

  // Pool view needs full card data; heroes view uses a fast SQL aggregate.
  let formatLists: CuratedListDTO[] = [];
  if (view === 'pool') {
    const poolResult = await curatedListService.getAllPublished({ includeCards: true });
    const lists = poolResult.success ? poolResult.data : [];
    formatLists = lists.filter(
      l => (l.format ?? '').toLowerCase() === selectedFormat.toLowerCase()
    );
  }

  const byHero = new Map<string, HeroSummary>();
  let generalCount = 0;
  if (view === 'heroes') {
    const summaries = await getCachedHeroSummaries(selectedFormat);
    for (const row of summaries) {
      if (row.heroName === null) {
        generalCount = row.kitCount;
        continue;
      }
      const info = getHeroInfo(row.heroName);
      byHero.set(row.heroName, {
        heroName: row.heroName,
        displayName: toHeroDisplayName(row.heroName, info?.shortName),
        className: info?.classes?.[0] ?? 'other',
        talents: info?.talents ?? [],
        kitCount: row.kitCount,
        totalTcgLow: row.totalTcgLow,
        livingLegendPoints: getLivingLegendPoints(row.heroName) ?? undefined,
      });
    }
  }

  // For CC format, also surface graduated Living Legends (>= 1000 pts) as a separate section.
  const isCC = selectedFormat === 'Classic Constructed';
  if (isCC && view === 'heroes') {
    for (const [heroKey, pts] of Object.entries(LIVING_LEGEND_POINTS)) {
      if (pts < LIVING_LEGEND_THRESHOLD) continue;
      if (byHero.has(heroKey)) continue;
      const info = getHeroInfo(heroKey);
      byHero.set(heroKey, {
        heroName: heroKey,
        displayName: toHeroDisplayName(heroKey, info?.shortName),
        className: info?.classes?.[0] ?? 'other',
        talents: info?.talents ?? [],
        kitCount: 0,
        livingLegendPoints: pts,
        graduated: true,
      });
    }
  }

  // Resolve hero portrait + stats via HERO_INFO.cardUniqueId (deterministic, set-independent).
  if (view === 'heroes' && byHero.size > 0) {
    const heroIdToName = new Map<string, string>();
    for (const summary of byHero.values()) {
      const info = getHeroInfo(summary.heroName);
      if (info?.cardUniqueId) heroIdToName.set(info.cardUniqueId, summary.heroName);
    }
    if (heroIdToName.size > 0) {
      const cardUniqueIds = Array.from(heroIdToName.keys());
      // One lean row per hero — the earliest printing (original art) plus
      // card-level stats. The purpose-built summary query avoids over-fetching
      // every printing (heroes average >10) and the row-limit truncation that
      // previously blanked late-sorting heroes' portraits.
      const summariesResult = await printingsService.getCardSummariesByUniqueIds(cardUniqueIds);
      if (summariesResult.success) {
        const idToSummary = new Map(summariesResult.data.map((s) => [s.cardUniqueId, s]));
        for (const [cardUniqueId, heroName] of heroIdToName) {
          const s = idToSummary.get(cardUniqueId);
          const summary = byHero.get(heroName);
          if (summary && s) {
            summary.imageUrl = s.representativeImageUrl ?? summary.imageUrl;
            summary.health = s.health ?? undefined;
            summary.intelligence = s.intelligence ?? undefined;
          }
        }
      }
    }

    // Prefer the Marvel (cold foil) artwork when available — the kits page has no
    // printing-legality constraint, so we can surface the more striking Marvel art.
    for (const summary of byHero.values()) {
      const marvelUrl = getHeroMarvelImageUrl(summary.heroName);
      if (marvelUrl) summary.imageUrl = marvelUrl;
    }
  }

  const allHeroes = Array.from(byHero.values()).sort((a, b) => {
    if (a.className === b.className) return a.displayName.localeCompare(b.displayName);
    return a.className.localeCompare(b.className);
  });
  const activeHeroes = allHeroes.filter(h => !h.graduated);
  const graduatedHeroes = allHeroes
    .filter(h => h.graduated)
    .sort((a, b) => (b.livingLegendPoints ?? 0) - (a.livingLegendPoints ?? 0));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Starter Kits</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Curated card packages by hero to help you start or refine a deck.
        </p>
      </header>

      <KitsFormatTabs selectedSlug={selectedSlug} />

      <div className="mb-4">
        <KitsViewToggle formatSlug={selectedSlug} selected={view} />
      </div>

      {view === 'pool' ? (
        formatLists.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-lg">
            <p className="text-lg">No starter kits published for {selectedFormat} yet.</p>
          </div>
        ) : (
          <KitPoolView lists={formatLists} formatSlug={selectedSlug} />
        )
      ) : (
        <>
          {generalCount > 0 && (
            <p className="text-xs text-muted-foreground mb-4">
              {generalCount} general kit{generalCount !== 1 ? 's' : ''} available across all heroes in this format.
            </p>
          )}

          {activeHeroes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-lg">
              <p className="text-lg">No starter kits published for {selectedFormat} yet.</p>
              <p className="text-sm mt-1">Try a different format.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {activeHeroes.map(h => (
                <HeroRosterTile
                  key={h.heroName}
                  hero={h}
                  href={`/kits/${selectedSlug}/${heroNameToSlug(h.heroName)}`}
                />
              ))}
            </div>
          )}

          {isCC && graduatedHeroes.length > 0 && (
            <section className="mt-12">
              <div className="mb-4 border-t border-gray-200 dark:border-gray-800 pt-6">
                <h2 className="text-xl font-bold text-foreground">Graduated Living Legends</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Heroes that have reached {LIVING_LEGEND_THRESHOLD.toLocaleString()} Living Legend points and are no longer legal in Classic Constructed.
                  {' '}
                  <span className="text-xs">
                    Points through {LIVING_LEGEND_POINTS_SOURCE_LABEL} ({LIVING_LEGEND_POINTS_UPDATED_AT}).
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {graduatedHeroes.map(h => (
                  <HeroRosterTile
                    key={h.heroName}
                    hero={h}
                    href={`/kits/${selectedSlug}/${heroNameToSlug(h.heroName)}`}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

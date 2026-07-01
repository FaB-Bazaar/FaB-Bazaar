"use client";

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import FoilCardImage from '@/components/shared/FoilCardImage';
import { artStylesFromPrinting, foilInsetFromValues } from '@/lib/foil';
import { TcgAffiliateLink } from '@/components/tracking';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { getHeroInfo, toHeroDisplayName } from '@/lib/fab-constants/heroes';
import { heroNameToSlug } from '@/lib/utils/kit-slugs';
import { formatSetCollector, type PoolCard } from '@/lib/utils/card-pool';

function displayHeroName(heroName: string | null): string | null {
  if (!heroName) return null;
  const info = getHeroInfo(heroName);
  return toHeroDisplayName(heroName.toLowerCase(), info?.shortName);
}

interface DedupedSource {
  key: string;
  heroName: string | null;
  listName: string;
  count: number;
}

function dedupeSourcesByHero(sources: PoolCard['sources']): DedupedSource[] {
  const byHero = new Map<string, DedupedSource>();
  const orphans: DedupedSource[] = [];
  for (const s of sources) {
    if (!s.heroName) {
      orphans.push({ key: s.listId, heroName: null, listName: s.listName, count: s.count });
      continue;
    }
    const k = s.heroName.toLowerCase();
    const existing = byHero.get(k);
    if (existing) existing.count += s.count;
    else byHero.set(k, { key: k, heroName: s.heroName, listName: s.listName, count: s.count });
  }
  return [...byHero.values(), ...orphans];
}

interface Props {
  card: PoolCard;
  formatSlug: string;
  ownedCount?: number;
  onHover?: (card: PoolCard | null) => void;
}

const FOILING_MAP: Record<string, { name: string; className: string }> = {
  R: { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
  C: { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
  G: { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
  S: { name: 'Non-foil', className: 'bg-gray-500 text-white' },
};

const EDITION_MAP: Record<string, string> = { a: 'Alpha', f: '1st', u: 'UNL', n: '' };

function getFoilingInfo(foiling: string | undefined) {
  const code = (foiling ?? '').toUpperCase();
  return FOILING_MAP[code] ?? { name: 'Non-foil', className: 'bg-gray-500 text-white' };
}

function getEditionDisplayName(code: string | undefined) {
  if (!code) return '';
  return EDITION_MAP[code.toLowerCase()] ?? code.toUpperCase();
}

function PriceLine({ label, price, isLow = false }: { label: string; price: number | undefined; isLow?: boolean }) {
  if (typeof price !== 'number') return null;
  return (
    <div className={`${isLow ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-300">{label}:</span>
        <span>${price.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function KitPoolCard({ card, formatSlug, ownedCount, onHover }: Props) {
  const foilingInfo = getFoilingInfo(card.foiling);
  const editionDisplay = getEditionDisplayName(card.edition);
  const capped = card.cappedCount < card.rawCount;
  const setCollector = formatSetCollector(card.setCode, card.collectorNumber);

  const artStyle = artStylesFromPrinting(card.artVariations, card.isExtendedArt);

  const ownedStyle = ownedCount === undefined
    ? null
    : ownedCount === 0
      ? { label: `Need ${card.cappedCount}`, className: 'bg-red-600/90 text-white', title: `You own 0 · need ${card.cappedCount}` }
      : ownedCount < card.cappedCount
        ? { label: `${ownedCount}/${card.cappedCount}`, className: 'bg-amber-500/90 text-white', title: `You own ${ownedCount} of ${card.cappedCount} needed` }
        : { label: `✓ ${ownedCount}`, className: 'bg-emerald-600/90 text-white', title: `You own ${ownedCount} (need ${card.cappedCount})` };

  const foilInset = foilInsetFromValues(card.foilInsetTop, card.foilInsetRight, card.foilInsetBottom, card.foilInsetLeft, card.foilInsetRound);

  return (
    <div
      className={cn(
        'w-full rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col shadow-md',
      )}
      onMouseEnter={() => onHover?.(card)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="relative w-full h-[200px] sm:h-[280px] bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center p-2">
        <FoilCardImage
          foiling={card.foiling}
          artStyle={artStyle}
          foilInset={foilInset}
          src={card.imageUrl ?? '/cardback.webp'}
          alt={card.displayName}
          className="w-full h-full"
          imgClassName="max-w-full max-h-full object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cardback.webp'; }}
        />

        {ownedStyle && (
          <div
            className={cn(
              'absolute top-2 left-2 text-xs px-2.5 py-1 rounded-full font-semibold pointer-events-none shadow-sm',
              ownedStyle.className,
            )}
            style={{ zIndex: 10 }}
            title={ownedStyle.title}
          >
            {ownedStyle.label}
          </div>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Included in ${card.sources.length} kit${card.sources.length === 1 ? '' : 's'}`}
              className={cn(
                'absolute top-2 right-2 text-sm px-3 py-1.5 rounded-full font-bold cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                'hover:scale-105 transition-transform',
                capped ? 'bg-amber-600/90 text-white' : 'bg-black/80 text-white'
              )}
              style={{ zIndex: 10 }}
              title={capped ? `Raw ${card.rawCount} capped to ${card.cap} — click to see kits` : 'Click to see kits'}
              onClick={e => e.stopPropagation()}
            >
              {card.cappedCount}x{capped ? '*' : ''}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-64 p-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                Included in {card.sources.length} kit{card.sources.length === 1 ? '' : 's'}
              </div>
              {capped && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  {card.rawCount} total · capped at {card.cap}
                </div>
              )}
            </div>
            <ul className="max-h-60 overflow-auto py-1">
              {dedupeSourcesByHero(card.sources).map(src => {
                const hero = displayHeroName(src.heroName);
                const heroHref = src.heroName
                  ? `/kits/${formatSlug}/${heroNameToSlug(src.heroName)}`
                  : null;
                if (heroHref && hero) {
                  return (
                    <li key={src.key}>
                      <Link
                        href={heroHref}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {hero}
                          <svg aria-hidden="true" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </span>
                        <span className="font-mono text-gray-600 dark:text-gray-400 shrink-0">×{src.count}</span>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={src.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200">
                    <span className="truncate font-medium">{src.listName}</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400 shrink-0">×{src.count}</span>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
        <div className="font-semibold text-sm leading-tight mb-2">{card.displayName}</div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {setCollector && <span className="font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">{setCollector}</span>}
              {editionDisplay && <span className="text-gray-600 dark:text-gray-300 uppercase">• {editionDisplay}</span>}
            </div>
          </div>

          {card.typeTextDisplay && (
            <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{card.typeTextDisplay}</div>
          )}

          <div className="space-y-1">
            <PriceLine label="Market" price={card.tcgMarket} />
            <PriceLine label="High" price={card.tcgHigh} />
            <PriceLine label="Mid" price={card.tcgMid} />
            <PriceLine label="Low" price={card.tcgLow} isLow />
            {card.tcgplayerUrl && (
              <div className="text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
                <TcgAffiliateLink
                  tcgplayerUrl={card.tcgplayerUrl}
                  feature="KitPoolPurchaseLink"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  title="Purchase on TCGPlayer"
                >
                  <span>Available for purchase here</span>
                  <img
                    src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                    alt="TCGPlayer"
                    className="h-4 w-auto"
                  />
                </TcgAffiliateLink>
              </div>
            )}
          </div>

          {card.comment && (
            <div className="text-xs text-gray-600 dark:text-gray-300 italic">{card.comment}</div>
          )}

          <div className="flex items-center gap-2">
            {card.rarityCode && <RarityIcon rarityCode={card.rarityCode} size="sm" />}
            {card.foiling && (
              <div className={`text-sm px-2 py-0.5 rounded-full text-center flex-1 ${foilingInfo.className}`}>
                {foilingInfo.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

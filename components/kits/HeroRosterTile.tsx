import Link from 'next/link';
import { Heart, Brain, Trophy, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroTileData {
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

const LL_THRESHOLD = 1000;

function formatUSD(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

const TALENT_COLOR: Record<string, string> = {
  light: 'text-amber-700 border-amber-400 dark:text-amber-300 dark:border-amber-400/50',
  shadow: 'text-violet-700 border-violet-400 dark:text-violet-300 dark:border-violet-400/50',
  ice: 'text-cyan-700 border-cyan-400 dark:text-cyan-300 dark:border-cyan-400/50',
  lightning: 'text-yellow-700 border-yellow-400 dark:text-yellow-300 dark:border-yellow-400/50',
  earth: 'text-lime-700 border-lime-500 dark:text-lime-300 dark:border-lime-400/50',
  elemental: 'text-emerald-700 border-emerald-500 dark:text-emerald-300 dark:border-emerald-400/50',
  mystic: 'text-fuchsia-700 border-fuchsia-400 dark:text-fuchsia-300 dark:border-fuchsia-400/50',
  chaos: 'text-red-700 border-red-400 dark:text-red-300 dark:border-red-400/50',
  revered: 'text-amber-700 border-amber-400 dark:text-amber-200 dark:border-amber-300/50',
  reviled: 'text-rose-700 border-rose-400 dark:text-rose-300 dark:border-rose-400/50',
  draconic: 'text-orange-700 border-orange-400 dark:text-orange-300 dark:border-orange-400/50',
  illusionist: 'text-sky-700 border-sky-400 dark:text-sky-300 dark:border-sky-400/50',
  shapeshifter: 'text-indigo-700 border-indigo-400 dark:text-indigo-300 dark:border-indigo-400/50',
};

interface Props {
  hero: HeroTileData;
  href: string;
}

export default function HeroRosterTile({ hero, href }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative block rounded-lg overflow-hidden',
        'border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-950',
        'shadow-md dark:shadow-none',
        'transition-all duration-200',
        'hover:border-blue-400 hover:-translate-y-1 hover:shadow-[0_8px_24px_-4px_rgba(96,165,250,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
      )}
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '63/66' }}>
        {hero.imageUrl ? (
          <img
            src={hero.imageUrl}
            alt={hero.displayName}
            className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground uppercase tracking-widest">
            {hero.className}
          </div>
        )}

        <div className="absolute top-2 right-2">
          {hero.graduated ? (
            <span className="bg-amber-500 text-amber-950 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-lg inline-flex items-center gap-1">
              <Crown className="h-3 w-3" aria-hidden />
              Legend
            </span>
          ) : (
            <span className="bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-lg">
              {hero.kitCount} KIT{hero.kitCount !== 1 ? 'S' : ''}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 dark:from-black via-black/60 dark:via-black/80 to-transparent pointer-events-none" />
      </div>

      <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-black border-t border-gray-300 dark:border-gray-800 p-3 space-y-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight tracking-wide uppercase truncate">
            {hero.displayName}
          </p>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5">
              {hero.className}
            </span>
            {hero.talents.map(t => (
              <span
                key={t}
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-widest rounded px-1.5 py-0.5 border bg-white/70 dark:bg-black/60',
                  TALENT_COLOR[t.toLowerCase()] ?? 'text-gray-700 border-gray-400 dark:text-gray-300 dark:border-gray-600'
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-gray-300 dark:border-gray-800/80">
          <div className="flex items-center gap-1.5" title="Starting life">
            <Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400 fill-red-500/40 dark:fill-red-400/40" />
            <span className="font-mono font-bold text-sm text-gray-900 dark:text-white tabular-nums">
              {hero.health ?? '—'}
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400">Life</span>
          </div>
          <div className="flex items-center gap-1.5" title="Intelligence">
            <Brain className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
            <span className="font-mono font-bold text-sm text-gray-900 dark:text-white tabular-nums">
              {hero.intelligence ?? '—'}
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400">Int</span>
          </div>
        </div>

        {(hero.livingLegendPoints !== undefined || (hero.totalTcgLow ?? 0) > 0) && (
          <div className="pt-2 border-t border-gray-300 dark:border-gray-800/80 space-y-1.5">
            {hero.livingLegendPoints !== undefined && (
              <div title={`${hero.livingLegendPoints} Living Legend points`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">
                    <Trophy className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden />
                    LL
                  </span>
                  <span className={cn(
                    'font-mono font-bold text-xs tabular-nums',
                    hero.graduated
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-gray-900 dark:text-white'
                  )}>
                    {hero.livingLegendPoints.toLocaleString()}
                    <span className="text-gray-500 dark:text-gray-500 font-normal"> / {LL_THRESHOLD.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      hero.graduated ? 'bg-amber-500 dark:bg-amber-400' : 'bg-blue-500 dark:bg-blue-400'
                    )}
                    style={{ width: `${Math.min(100, (hero.livingLegendPoints / LL_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {(hero.totalTcgLow ?? 0) > 0 && (
              <div className="flex items-center justify-between" title="Total kit cost (TCGplayer low)">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">
                  Kit Cost
                </span>
                <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatUSD(hero.totalTcgLow!)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

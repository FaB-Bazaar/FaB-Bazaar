"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { CuratedListDTO } from '@/lib/services/contracts/ICuratedListService';
import { computeCardPool, buildKitOptions, sortPoolCards, type PoolSortMode, type PoolCard } from '@/lib/utils/card-pool';
import KitPoolCard from './KitPoolCard';

interface Props {
  lists: CuratedListDTO[];
  formatSlug: string;
}

export default function KitPoolView({ lists, formatSlug }: Props) {
  const [listFilter, setListFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<PoolSortMode>('alpha');

  const pool = useMemo(
    () => computeCardPool(lists, listFilter ? { listIdFilter: listFilter } : {}),
    [lists, listFilter]
  );

  const sortedByRarity = useMemo(
    () => pool.byRarity.map(g => ({ ...g, cards: sortPoolCards(g.cards, sortMode) })),
    [pool.byRarity, sortMode]
  );

  const kitOptions = useMemo(() => buildKitOptions(lists), [lists]);

  const [hovered, setHovered] = useState<PoolCard | null>(null);

  const { status: sessionStatus } = useSession();
  const [ownedCounts, setOwnedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    const ids = Array.from(new Set(pool.cards.map(c => c.cardUniqueId))).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/inventory/owned-counts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardUniqueIds: ids }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.success) setOwnedCounts(json.data ?? {});
      } catch {
        // ignore — UI degrades to no-ownership display
      }
    })();
    return () => { cancelled = true; };
  }, [sessionStatus, pool.cards]);

  const totalCapped = pool.cards.reduce((sum, c) => sum + c.cappedCount, 0);
  const totalRaw = pool.cards.reduce((sum, c) => sum + c.rawCount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-muted-foreground" htmlFor="list-filter">Kit:</label>
        <select
          id="list-filter"
          value={listFilter}
          onChange={e => setListFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-card text-sm px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <option value="">All kits ({lists.length})</option>
          {kitOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <label className="text-sm text-muted-foreground ml-2" htmlFor="sort-mode">Sort:</label>
        <select
          id="sort-mode"
          value={sortMode}
          onChange={e => setSortMode(e.target.value as PoolSortMode)}
          className="h-9 rounded-md border border-border bg-card text-sm px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <option value="alpha">Alphabetical</option>
          <option value="set">By set</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {pool.cards.length} unique · {totalCapped} card{totalCapped !== 1 ? 's' : ''} after caps
          {totalRaw !== totalCapped && (
            <span className="ml-1 text-muted-foreground/70">({totalRaw} pre-cap)</span>
          )}
        </span>
      </div>

      {sortedByRarity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards in this kit yet.</p>
      ) : (
        sortedByRarity.map(group => (
          <section key={group.rarity}>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
              {group.rarity}
              <span className="ml-2 font-normal text-muted-foreground normal-case tracking-normal">
                {group.cards.length}
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {group.cards.map(card => (
                <KitPoolCard
                  key={card.cardUniqueId}
                  card={card}
                  formatSlug={formatSlug}
                  ownedCount={ownedCounts[card.cardUniqueId]}
                  onHover={setHovered}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {hovered?.imageUrl && (
        <div
          className="fixed pointer-events-none rounded-lg overflow-hidden shadow-2xl hidden lg:block z-50"
          style={{
            width: 280,
            aspectRatio: '63/88',
            top: '50%',
            right: '2rem',
            transform: 'translateY(-50%)',
          }}
        >
          <img src={hovered.imageUrl} alt={hovered.displayName} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

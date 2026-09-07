'use client';

/**
 * Card types present in a hero's legal pool (Set of lower-cased type tokens),
 * fetched once per hero/format from /api/cards/by-hero — the slim one-row-per-
 * card endpoint that already carries each card's `types`. Feeds
 * availableTypeChips (lib/deck) so the Add Card surfaces only offer Type chips
 * that can return something for this hero.
 *
 * Returns null while loading / disabled / on error → callers show every chip.
 */

import { useEffect, useState } from 'react';
import type { HeroFilter } from '@/lib/deck/resolve-hero-filter';
import { poolTypeSet } from '@/lib/deck/available-type-chips';
import { getApiFormatCode } from '@/lib/format-constants';

export function useHeroPoolTypes(hero: HeroFilter | null, deckFormat: string | undefined, enabled: boolean): Set<string> | null {
  const [types, setTypes] = useState<Set<string> | null>(null);
  const key = hero ? JSON.stringify([hero.heroClasses, hero.heroTalents, hero.heroEssences, deckFormat ?? null]) : null;

  useEffect(() => {
    if (!enabled || !hero || !key) { setTypes(null); return; }
    let cancelled = false;
    const params = new URLSearchParams();
    if (hero.heroClasses.length) params.set('heroClasses', hero.heroClasses.join(','));
    if (hero.heroTalents.length) params.set('heroTalents', hero.heroTalents.join(','));
    if (hero.heroEssences.length) params.set('heroEssences', hero.heroEssences.join(','));
    const code = deckFormat ? getApiFormatCode(deckFormat) : null;
    if (code) params.set('format', code);
    fetch(`/api/cards/by-hero?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setTypes(j?.success && Array.isArray(j.data) ? poolTypeSet(j.data) : null);
      })
      .catch(() => { if (!cancelled) setTypes(null); });
    return () => { cancelled = true; };
    // key encodes every hero/format input; `hero` itself is a fresh object per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return types;
}

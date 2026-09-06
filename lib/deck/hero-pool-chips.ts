/**
 * Chips for the Add Card dialog's hero-pool quick filter: one per affiliation
 * the hero can play (classes, talents, essence elements that are searchable
 * talents) plus Generic. Pure — the dialog feeds them to buildFilterFacets,
 * and each chip toggles the same selectedClasses / selectedTalents state the
 * /opt Class and Talent facets use, so buildServerFilters needs no changes.
 */

import { OFFICIAL_TALENTS } from '@/lib/talent-constants';
import type { HeroFilter } from './resolve-hero-filter';

export interface HeroPoolChip {
  kind: 'class' | 'talent';
  value: string;
  label: string;
}

const TALENT_SET = new Set<string>(OFFICIAL_TALENTS);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function heroPoolChips(hero: HeroFilter | null): HeroPoolChip[] {
  if (!hero) return [];
  const chips: HeroPoolChip[] = [];
  const seen = new Set<string>();
  const push = (kind: HeroPoolChip['kind'], value: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    chips.push({ kind, value, label: cap(value) });
  };
  for (const c of hero.heroClasses) if (c !== 'generic') push('class', c);
  for (const t of hero.heroTalents) push('talent', t);
  // Essence elements (Oldhim's ice/earth) are talent chips only when the DB
  // actually stores them as talents — 'fire'/'water' would match nothing.
  for (const e of hero.heroEssences) if (TALENT_SET.has(e)) push('talent', e);
  push('class', 'generic');
  return chips;
}

/**
 * Pure human-readable projections of the /opt search state (OptUiState):
 *
 *  - optStateToChips: the active-filter chip descriptors the page renders.
 *    Each chip carries a reducer action (not a closure) that removes it, so
 *    the list is unit-testable and usable outside the page component.
 *  - describeOptState: a compact one-line context string in the same register
 *    as the volzar quick-action `context` strings — used by Bridge B to
 *    carry the user's current search into the hosted chat.
 *
 * Pack names come from a fetched list the server doesn't have; callers pass
 * meta.availablePacks when they do, and labels degrade to "Pack <id>".
 */

import { SET_MAP } from '@/lib/fab-constants';
import {
  TYPE_CHIPS, PITCH_CHIPS, KEYWORD_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS,
  EDITION_OPTIONS, FORMAT_OPTIONS, HERO_AGE_CHIPS,
} from './card-filter-chips';
import type { OptUiState } from './opt-url-state';
import type { OptAction } from './opt-search-reducer';

export interface OptChip {
  key: string;
  label: string;
  /** Dispatching this through optSearchReducer removes the chip. */
  removeAction: OptAction;
}

export interface OptDescribeMeta {
  /** Fetched pack names for selected sets; labels fall back to "Pack <id>". */
  availablePacks?: { groupId: number; name: string }[];
  /** Facet id → display label (fetched vocabulary); labels fall back to the id. */
  facetLabels?: Record<string, string>;
  /** Result count to include in the description. */
  total?: number;
  /** Canonical /opt link to include in the description. */
  optUrl?: string;
}

const rangeLabel = (label: string, min: string, max: string) =>
  min && max ? `${label} ${min}–${max}` : min ? `${label} ≥ ${min}` : `${label} ≤ ${max}`;

export function optStateToChips(s: OptUiState, meta?: OptDescribeMeta): OptChip[] {
  const chips: OptChip[] = [];
  s.selectedPitch.forEach(pitch => {
    const p = PITCH_CHIPS.find(c => c.value === pitch);
    chips.push({ key: `pitch:${pitch}`, label: `Pitch: ${p?.label ?? pitch}`, removeAction: { type: 'TOGGLE_PITCH', value: pitch } });
  });
  if (s.selectedType) {
    const t = TYPE_CHIPS.find(c => c.value === s.selectedType);
    chips.push({ key: 'type', label: t?.label ?? s.selectedType, removeAction: { type: 'PATCH', patch: { selectedType: null } } });
  }
  s.selectedHeroAges.forEach(age => {
    const def = HERO_AGE_CHIPS.find(c => c.value === age);
    chips.push({ key: `hero:${age}`, label: def?.label ?? age, removeAction: { type: 'TOGGLE_HERO_AGE', value: age } });
  });
  s.selectedClasses.forEach(cls => {
    chips.push({ key: `class:${cls}`, label: cls, removeAction: { type: 'TOGGLE_IN', key: 'selectedClasses', value: cls } });
  });
  s.selectedTalents.forEach(tal => {
    chips.push({ key: `talent:${tal}`, label: tal, removeAction: { type: 'TOGGLE_TALENT', value: tal } });
  });
  if (s.selectedTalentless) {
    chips.push({ key: 'talentless', label: 'Talentless', removeAction: { type: 'TOGGLE_TALENTLESS' } });
  }
  s.selectedKeywords.forEach(kw => {
    const def = KEYWORD_CHIPS.find(k => k.value === kw);
    chips.push({ key: `kw:${kw}`, label: def?.label ?? kw, removeAction: { type: 'TOGGLE_IN', key: 'selectedKeywords', value: kw } });
  });
  s.selectedFacets.forEach(tag => {
    chips.push({ key: `facet:${tag}`, label: `Facet: ${meta?.facetLabels?.[tag] ?? tag}`, removeAction: { type: 'TOGGLE_IN', key: 'selectedFacets', value: tag } });
  });
  s.selectedRarities.forEach(r => {
    const def = RARITY_OPTIONS.find(o => o.value === r);
    chips.push({ key: `rar:${r}`, label: def?.label ?? r, removeAction: { type: 'TOGGLE_IN', key: 'selectedRarities', value: r } });
  });
  s.selectedFoilings.forEach(f => {
    const def = FOILING_OPTIONS.find(o => o.value === f);
    chips.push({ key: `foil:${f}`, label: def?.label ?? f, removeAction: { type: 'TOGGLE_IN', key: 'selectedFoilings', value: f } });
  });
  s.selectedEditions.forEach(e => {
    const def = EDITION_OPTIONS.find(o => o.value === e);
    chips.push({ key: `ed:${e}`, label: def?.label ?? e, removeAction: { type: 'TOGGLE_IN', key: 'selectedEditions', value: e } });
  });
  if (s.selectedFormat) {
    const def = FORMAT_OPTIONS.find(o => o.value === s.selectedFormat);
    chips.push({ key: 'format', label: `Format: ${def?.label ?? s.selectedFormat}`, removeAction: { type: 'PATCH', patch: { selectedFormat: null } } });
  }
  s.selectedSets.forEach(set => {
    chips.push({ key: `set:${set}`, label: SET_MAP[set.toLowerCase() as keyof typeof SET_MAP] ?? set, removeAction: { type: 'TOGGLE_IN', key: 'selectedSets', value: set } });
  });
  s.selectedPacks.forEach(g => {
    const pack = meta?.availablePacks?.find(p => p.groupId === g);
    chips.push({ key: `pack:${g}`, label: pack?.name ?? `Pack ${g}`, removeAction: { type: 'TOGGLE_PACK', value: g } });
  });
  if (s.costMin || s.costMax) chips.push({ key: 'cost', label: rangeLabel('Cost', s.costMin, s.costMax), removeAction: { type: 'CLEAR_RANGE', range: 'cost' } });
  if (s.powerMin || s.powerMax) chips.push({ key: 'power', label: rangeLabel('Power', s.powerMin, s.powerMax), removeAction: { type: 'CLEAR_RANGE', range: 'power' } });
  if (s.defenseMin || s.defenseMax) chips.push({ key: 'def', label: rangeLabel('Defense', s.defenseMin, s.defenseMax), removeAction: { type: 'CLEAR_RANGE', range: 'defense' } });
  if (s.arcaneMin || s.arcaneMax) chips.push({ key: 'arcane', label: rangeLabel('Arcane', s.arcaneMin, s.arcaneMax), removeAction: { type: 'CLEAR_RANGE', range: 'arcane' } });
  if (s.priceMin || s.priceMax) {
    const priceLabel = s.priceMin && s.priceMax
      ? `$${s.priceMin}–$${s.priceMax}`
      : s.priceMin ? `≥ $${s.priceMin}` : `≤ $${s.priceMax}`;
    chips.push({ key: 'price', label: priceLabel, removeAction: { type: 'CLEAR_RANGE', range: 'price' } });
  }
  const isDefaultLang = s.selectedLanguages.length === 1 && s.selectedLanguages[0] === 'en';
  if (!isDefaultLang) {
    const label = s.selectedLanguages.length === 0
      ? 'All languages'
      : 'Lang: ' + s.selectedLanguages.map(c => c.toUpperCase()).join(', ');
    chips.push({ key: 'lang', label, removeAction: { type: 'PATCH', patch: { selectedLanguages: ['en'] } } });
  }
  return chips;
}

export function describeOptState(s: OptUiState, meta?: OptDescribeMeta): string {
  const segments: string[] = [];
  const q = s.query.trim();
  if (q) segments.push(`query "${q}" (${s.searchMode === 'text' ? 'rule-text search' : 'name search'})`);
  const labels = optStateToChips(s, meta).map(c => c.label);
  if (labels.length) segments.push(`filters: ${labels.join(', ')}`);
  if (!segments.length) segments.push('no filters set');

  const totalPart = meta?.total !== undefined ? ` (${meta.total} results)` : '';
  let out = `The user's current /opt card search${totalPart}: ${segments.join('; ')}.`;
  if (meta?.optUrl) out += ` Link: ${meta.optUrl}`;
  return out;
}

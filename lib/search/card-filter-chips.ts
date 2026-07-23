/**
 * Shared chip constants for card filter UIs.
 * Used by both QuickAddCardDialog (hero-constrained) and the global /search page (unconstrained).
 */

import { OFFICIAL_TALENTS } from '@/lib/talent-constants';

export interface ChipDef {
  label: string;
  value: string;
  apiType: string;
  active: string;
  dot: string;
  iconUrl?: string;
  iconPosition?: string;
}

export const TYPE_CHIPS: ChipDef[] = [
  // Row 1
  { label: 'Attack',    value: 'attack',            apiType: 'attack',           active: 'bg-red-900/50 border-red-600',          dot: 'bg-red-500',     iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR200-UL/public', iconPosition: 'center 24%' },
  { label: 'Action',    value: 'non-attack-action', apiType: 'action',           active: 'bg-emerald-900/50 border-emerald-600',  dot: 'bg-emerald-400', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DTD230/public', iconPosition: 'center 24%' },
  { label: 'Item',      value: 'item',              apiType: 'item',             active: 'bg-purple-900/50 border-purple-600',    dot: 'bg-purple-500',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR170-UL/public', iconPosition: 'center 24%' },
  // Row 2
  { label: 'Atk React', value: 'attack-reaction',   apiType: 'attack reaction',  active: 'bg-orange-900/50 border-orange-600',    dot: 'bg-orange-400',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR206-UL/public', iconPosition: 'center 24%' },
  { label: 'Def React', value: 'defense-reaction',  apiType: 'defense reaction', active: 'bg-blue-900/50 border-blue-600',         dot: 'bg-blue-500',    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR215-UL/public', iconPosition: 'center 24%' },
  { label: 'Instant',   value: 'instant',           apiType: 'instant',          active: 'bg-cyan-900/50 border-cyan-600',         dot: 'bg-cyan-400',    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR173-UL/public', iconPosition: 'center 24%' },
  // Row 3
  // ­ soft hyphen: renders "Equip-ment" only where the chip is too narrow for one line
  { label: 'Equip­ment', value: 'equipment',   apiType: 'equipment',        active: 'bg-teal-900/50 border-teal-600',         dot: 'bg-teal-500',    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR150-RF-UL/public', iconPosition: 'center 24%' },
  { label: 'Weapon',    value: 'weapon',            apiType: 'weapon',           active: 'bg-amber-900/50 border-amber-600',       dot: 'bg-amber-500',   iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU177-1E/public', iconPosition: 'center 24%' },
  { label: 'Block',     value: 'block',             apiType: 'block',            active: 'bg-slate-700 border-slate-500',          dot: 'bg-slate-400',   iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/SEA212/public', iconPosition: 'center 24%' },
  // Row 4
  { label: 'Gem',       value: 'gem',               apiType: 'gem',              active: 'bg-pink-900/50 border-pink-600',          dot: 'bg-pink-400',    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/ARC000-CF-1E/public', iconPosition: 'center 24%' },
  { label: 'Ally',      value: 'ally',              apiType: 'ally',             active: 'bg-green-900/50 border-green-600',       dot: 'bg-green-500',   iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/SEA050/public', iconPosition: 'center 24%' },
  { label: 'Evo',       value: 'evo',               apiType: 'evo',              active: 'bg-sky-900/50 border-sky-600',            dot: 'bg-sky-400',     iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/EVO027-CF-AB/public', iconPosition: 'center 24%' },
];

export const GENERIC_CHIP: ChipDef = {
  label: 'Generic', value: 'generic', apiType: 'generic',
  active: 'bg-gray-700 border-gray-500', dot: 'bg-gray-400',
  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR159-UL/public', iconPosition: 'center 24%',
};

export const CLASS_ICONS: Record<string, { iconUrl: string; iconPosition?: string }> = {
  guardian:      { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU022-UL/public', iconPosition: 'center 24%' },
  ninja:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU045-UL/public', iconPosition: 'center 24%' },
  warrior:       { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR113-UL/public', iconPosition: 'center 24%' },
  brute:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR001-UL/public', iconPosition: 'center 24%' },
  runeblade:     { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/HER019-RF/public', iconPosition: 'center 24%' },
  mechanologist: { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU098-1E/public', iconPosition: 'center 24%' },
  wizard:        { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU158-1E/public', iconPosition: 'center 24%' },
  illusionist:   { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MON089-CF-1E/public', iconPosition: 'center 24%' },
  necromancer:   { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/SEA080-CF-EA-EA/public', iconPosition: 'center 24%' },
  ranger:        { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/AAZ001/public', iconPosition: 'center 24%' },
  pirate:        { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/SEA125-CF/public', iconPosition: 'center 24%' },
  draconic:      { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/UPR084-RF/public', iconPosition: 'center 24%' },
  light:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MON063-RF-1E/public', iconPosition: 'center 24%' },
  shadow:        { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MON193-RF-1E/public', iconPosition: 'center 24%' },
  earth:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/AJV028/public', iconPosition: 'center 24%' },
  lightning:     { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/BRI002/public', iconPosition: 'center 24%' },
  chaos:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/AAC014/public', iconPosition: 'center 24%' },
  reviled:       { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/FR_SUP090/public', iconPosition: 'center 24%' }, // SUP090
  revered:       { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/FR_SUP046/public', iconPosition: 'center 24%' }, // SUP046
  // 'generic' reuses the generic art used by the (former) Type chip.
  generic:       { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR159-UL/public', iconPosition: 'center 24%' },
  // Talent tiles that had no art — chosen card images (PEN206 / MST096 / ELE146 / DYN001).
  elemental:     { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/PEN206-RF/public', iconPosition: 'center 24%' },
  mystic:        { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/JA_MST096-CF-FA/public', iconPosition: 'center 24%' },
  ice:           { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/ELE146-RF-1E-AA/public', iconPosition: 'center 24%' },
  royal:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DYN001-CF-AB/public', iconPosition: 'center 24%' },
  // Previously icon-less classes — card / hero art.
  assassin:      { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/JA_SAR032/public', iconPosition: 'center 24%' }, // Shred (SAR032)
  adjudicator:   { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/JDG001-CF/public', iconPosition: 'center 24%' }, // Taipanis (JDG001)
  bard:          { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/LSS004-CF-FA/public', iconPosition: 'center 24%' }, // Yorick (LSS004)
  merchant:      { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/IT_1HP220/public', iconPosition: 'center 24%' }, // Kavdaen (1HP220)
  shapeshifter:  { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU097-CF-1E/public', iconPosition: 'center 24%' }, // Shiyana (CRU097)
  thief:         { iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/SEA123/public', iconPosition: 'center 24%' }, // Scurv (SEA123)
};

export const ALL_CLASSES = [
  // Playable classes + generic, alphabetical.
  'assassin', 'brute', 'generic', 'guardian', 'illusionist', 'mechanologist',
  'necromancer', 'ninja', 'pirate', 'ranger', 'runeblade', 'warrior', 'wizard',
  // Niche / NPC classes (small card counts), alphabetical — kept at the bottom.
  'adjudicator', 'bard', 'merchant', 'shapeshifter', 'thief',
] as const;

// Talent chips, sourced from the official talent enum (single source of truth),
// alphabetical. Pirate is a CLASS, not a talent (migration 0065).
export const ALL_TALENTS: string[] = [...OFFICIAL_TALENTS].sort();

export const PITCH_CHIPS = [
  { label: 'Red',    value: 1, active: 'bg-red-900/50 border-red-500',       dot: 'bg-red-500',    iconUrl: '/fab/symbols/pitch1.png' },
  { label: 'Yellow', value: 2, active: 'bg-yellow-900/50 border-yellow-500', dot: 'bg-yellow-400', iconUrl: '/fab/symbols/pitch2.png' },
  { label: 'Blue',   value: 3, active: 'bg-blue-900/50 border-blue-500',     dot: 'bg-blue-500',   iconUrl: '/fab/symbols/pitch3.png' },
];

export const KEYWORD_CHIPS: { label: string; value: string; abbr: string; iconUrl?: string; iconPosition?: string }[] = [
  { label: 'Go Again',       value: 'go again',       abbr: 'GA',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MST225/public' },
  { label: 'Dominate',       value: 'dominate',       abbr: 'DOM', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/AAZ016/public' },
  { label: 'Arcane Barrier', value: 'arcane barrier', abbr: 'AB',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/EVR154-1E/public' },
  { label: 'Stealth',        value: 'stealth',        abbr: 'STL', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/HNT013/public' },
  { label: 'Phantasm',       value: 'phantasm',       abbr: 'PHN', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/EVO244/public' },
  { label: 'Combo',          value: 'combo',          abbr: 'CMB', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/PEN035/public' },
  { label: 'Intimidate',     value: 'intimidate',     abbr: 'INT', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/HVY003/public' },
  { label: 'Crush',          value: 'crush',          abbr: 'CRU', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR044-UL/public' },
  { label: 'Ward',           value: 'ward',           abbr: 'WRD', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DTD007_BACK/public' },
  { label: 'Reprise',        value: 'reprise',        abbr: 'REP', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/CRU083-UL/public' },
  { label: 'Blade Break',    value: 'blade break',    abbr: 'BB',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DYN090/public' },
  { label: 'Boost',          value: 'boost',          abbr: 'BST', iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/EVO142/public' },
  { label: 'Blood Debt',     value: 'blood debt',     abbr: 'BD',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DTD138/public' },
  { label: 'Battleworn',     value: 'battleworn',     abbr: 'BW',  iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/PEN057/public' },
];

export const RARITY_OPTIONS = [
  { value: 'v', label: 'Marvel' },
  { value: 'f', label: 'Fabled' },
  { value: 'l', label: 'Legendary' },
  { value: 'm', label: 'Majestic' },
  { value: 'p', label: 'Promo' },
  { value: 's', label: 'Super Rare' },
  { value: 'r', label: 'Rare' },
  { value: 'c', label: 'Common' },
  { value: 't', label: 'Token' },
  { value: 'b', label: 'Basic' },
];

export const FOILING_OPTIONS = [
  { value: 's', label: 'Non-foil',    swatch: 'bg-gray-300 dark:bg-gray-500' },
  { value: 'r', label: 'Rainbow Foil', swatch: 'bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400' },
  { value: 'c', label: 'Cold Foil',   swatch: 'bg-gradient-to-br from-cyan-200 to-cyan-400' },
  { value: 'g', label: 'Gold Foil',   swatch: 'bg-gradient-to-br from-yellow-300 to-yellow-500' },
];

// Hero age chips — multi-select (OR): adult and/or young. Unlike the single-select
// regular types, a hero can be filtered as adult, young, or both. Images: WTR038
// (Bravo, Showstopper — adult) and WTR039 (Bravo — young).
export const HERO_AGE_CHIPS = [
  {
    value: 'adult', label: 'Adult Hero',
    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR038-AL/public',
    iconPosition: 'center 22%',
    active: 'bg-amber-900/50 border-amber-600',
  },
  {
    value: 'young', label: 'Young Hero',
    iconUrl: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WTR039-AL/public',
    iconPosition: 'center 22%',
    active: 'bg-lime-900/50 border-lime-600',
  },
] as const;

// Quick price buckets (priced on tcg_low, English printings only). Each maps to
// a (priceMin, priceMax) pair as strings — '' means that bound is unset.
export const PRICE_PRESETS = [
  { label: 'Under $10', min: '', max: '10' },
  { label: 'Under $25', min: '', max: '25' },
  { label: 'Under $50', min: '', max: '50' },
  { label: 'Over $50', min: '50', max: '' },
] as const;

// Values match PrintingsSearchFilters['format']. CC and Silver Age lead — the
// two formats players filter for most.
export const FORMAT_OPTIONS = [
  { value: 'cc', label: 'Classic Constructed' },
  { value: 'silver_age', label: 'Silver Age' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'll', label: 'Living Legend' },
  { value: 'commoner', label: 'Commoner' },
] as const;

export const EDITION_OPTIONS = [
  { value: 'f', label: '1st Edition' },
  { value: 'a', label: 'Alpha' },
  { value: 'u', label: 'Unlimited' },
  { value: 'n', label: 'Normal' },
];

// lib/sets/set-input.ts — validation for registering / editing a set from
// /admin/cardvault. Pure (shared by the API route and the form).
//
// The form asks for a plain "kind of product"; the `sets` row stores the
// category + tier the site sorts and groups by (lib/fab-constants/sets.ts).

export const PRODUCT_KINDS = [
  { value: 'booster', label: 'Booster set', hint: 'A main set — Omens, Usurp the Shadow Throne…', category: 'standard', tier: 1 },
  { value: 'supplemental', label: 'Supplemental pack', hint: 'History Pack, Compendium, Mastery Pack…', category: 'standard', tier: 2 },
  { value: 'deck', label: 'Hero / Blitz / Silver Age deck', hint: 'Grouped under its deck type in the set filter by name', category: 'non-standard', tier: 3 },
  { value: 'armory', label: 'Armory deck', hint: 'Grouped under Armory Decks', category: 'armory', tier: 4 },
  { value: 'promo', label: 'Promos / other product', hint: 'Promo cards, battle decks, one-offs', category: 'non-standard', tier: 5 },
  { value: 'hidden', label: 'Hidden', hint: 'Kept out of the set lists (demo decks…)', category: 'excluded', tier: 5 },
] as const;

export type ProductKind = typeof PRODUCT_KINDS[number]['value'];
export type SetCategory = typeof PRODUCT_KINDS[number]['category'];

/** category + tier → the form's product kind (best match for an existing row). */
export function kindOf(category: string, tier: number): ProductKind {
  return (PRODUCT_KINDS.find((k) => k.category === category && k.tier === tier)
    ?? PRODUCT_KINDS.find((k) => k.category === category)
    ?? PRODUCT_KINDS[4]).value;
}

export interface TcgGroupRef { groupId: number; name: string }

export interface SetFields {
  code: string;
  displayCode: string;
  name: string;
  releaseDate: string | null;
  legalFrom: string | null;
  category: SetCategory;
  tier: number;
  hasFirstEdition: boolean;
  unlimitedBeforeFirst: boolean;
  inCardFilters: boolean | null;
  tcgGroups: TcgGroupRef[];
}

export type ParsedSetInput<M extends 'register' | 'update'> =
  | { ok: true; value: M extends 'register' ? SetFields : Partial<Omit<SetFields, 'code' | 'displayCode'>> }
  | { ok: false; errors: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function parseSetInput<M extends 'register' | 'update'>(raw: unknown, mode: M): ParsedSetInput<M> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const out: Record<string, unknown> = {};
  const has = (k: string) => mode === 'register' || k in b;

  if (mode === 'register') {
    const code = typeof b.code === 'string' ? b.code.trim().toLowerCase() : '';
    if (!/^[a-z0-9]{2,10}$/.test(code)) errors.code = 'Use 2–10 letters or digits, e.g. SPW.';
    out.code = code;
    out.displayCode = code.toUpperCase();
  }

  if (has('name')) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name || name.length > 120) errors.name = 'Give the set its name (up to 120 characters).';
    out.name = name;
  }

  for (const field of ['releaseDate', 'legalFrom'] as const) {
    if (!has(field)) continue;
    const v = b[field];
    if (v === undefined || v === null || v === '') { out[field] = null; continue; }
    if (typeof v !== 'string' || !isRealDate(v)) errors[field] = 'Use a date like 2026-10-30, or leave it empty.';
    out[field] = v;
  }

  if (has('kind')) {
    const kind = PRODUCT_KINDS.find((k) => k.value === b.kind);
    if (!kind) errors.kind = 'Choose what kind of product this is.';
    else { out.category = kind.category; out.tier = kind.tier; }
  }

  for (const flag of ['hasFirstEdition', 'unlimitedBeforeFirst'] as const) {
    if (has(flag)) out[flag] = b[flag] === true;
  }
  if (has('inCardFilters')) out.inCardFilters = b.inCardFilters === true ? true : b.inCardFilters === false ? false : null;

  if (has('tcgGroups')) {
    const groups = b.tcgGroups ?? [];
    const parsed: TcgGroupRef[] = [];
    if (!Array.isArray(groups) || groups.length > 20) errors.tcgGroups = 'Pick up to 20 TCGplayer groups.';
    else {
      for (const g of groups as Array<Record<string, unknown>>) {
        const id = g?.groupId;
        const name = typeof g?.name === 'string' ? g.name.trim() : '';
        if (!Number.isInteger(id) || (id as number) <= 0 || !name) { errors.tcgGroups = 'Each TCGplayer group needs its id and name.'; break; }
        if (!parsed.some((p) => p.groupId === id)) parsed.push({ groupId: id as number, name });
      }
    }
    out.tcgGroups = parsed;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: out } as ParsedSetInput<M>;
}

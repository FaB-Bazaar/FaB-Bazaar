import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes';

export const FORMAT_SLUG_TO_NAME: Record<string, string> = {
  cc: 'Classic Constructed',
  sage: 'Silver Age',
  blitz: 'Blitz',
  ll: 'Living Legend',
  limited: 'Limited',
  commoner: 'Commoner',
};

export const FORMAT_NAME_TO_SLUG: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Silver Age': 'sage',
  'Blitz': 'blitz',
  'Living Legend': 'll',
  'Limited': 'limited',
  'Commoner': 'commoner',
};

export const KIT_FORMAT_SLUGS = ['cc', 'sage', 'blitz', 'll', 'limited', 'commoner'] as const;
export type KitFormatSlug = typeof KIT_FORMAT_SLUGS[number];

export function slugToFormat(slug: string): string | null {
  return FORMAT_SLUG_TO_NAME[slug.toLowerCase()] ?? null;
}

export function formatToSlug(format: string): string | null {
  return FORMAT_NAME_TO_SLUG[format] ?? null;
}

export function heroNameToSlug(heroName: string): string {
  return heroName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let slugToHeroNameMap: Map<string, string> | null = null;

function buildSlugMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of Object.keys(HERO_INFO)) map.set(heroNameToSlug(name), name);
  for (const name of Object.keys(YOUNG_HERO_INFO)) {
    const slug = heroNameToSlug(name);
    if (!map.has(slug)) map.set(slug, name);
  }
  return map;
}

export function slugToHeroName(slug: string): string | null {
  if (!slugToHeroNameMap) slugToHeroNameMap = buildSlugMap();
  return slugToHeroNameMap.get(slug.toLowerCase()) ?? null;
}

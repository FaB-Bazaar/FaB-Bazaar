// lib/home/spoiler-set.ts — which set the signed-out homepage promotes as
// "spoiler season": the soonest main booster set (standard, tier 1) whose
// release date is still ahead. DB-driven, so registering the next set on
// /admin/cardvault moves the banner on with no code change.

import type { SetDTO } from '@/lib/services/contracts/ISetsService';

export interface SpoilerSet {
  code: string;
  name: string;
  releaseDate: string;
  imageId: string | null;
}

export function pickSpoilerSet(
  sets: Array<Pick<SetDTO, 'code' | 'name' | 'releaseDate' | 'category' | 'tier' | 'imageId'>>,
  today: string,
): SpoilerSet | null {
  const upcoming = sets
    .filter((s) => s.releaseDate && s.releaseDate > today && s.category === 'standard' && s.tier === 1)
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
  const s = upcoming[0];
  return s ? { code: s.code, name: s.name, releaseDate: s.releaseDate!, imageId: s.imageId ?? null } : null;
}

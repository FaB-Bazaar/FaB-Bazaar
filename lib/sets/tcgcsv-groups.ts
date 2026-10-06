// lib/sets/tcgcsv-groups.ts — Flesh and Blood groups on TCGplayer, via tcgcsv
// (the same source the pipeline prices from). Cached an hour in-process.

const TCGCSV_GROUPS = 'https://tcgcsv.com/tcgplayer/62/groups'; // 62 = Flesh and Blood
const TTL_MS = 60 * 60 * 1000;

export interface TcgcsvGroup { groupId: number; name: string; abbreviation: string | null; publishedOn: string | null }

let cache: { at: number; groups: TcgcsvGroup[] } | null = null;

/** Throws when tcgcsv can't be reached and nothing is cached. */
export async function fetchTcgcsvGroups(): Promise<TcgcsvGroup[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.groups;
  const res = await fetch(TCGCSV_GROUPS, { headers: { 'User-Agent': 'FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)' } });
  if (!res.ok) throw new Error(`tcgcsv answered ${res.status}`);
  const body = await res.json();
  cache = {
    at: Date.now(),
    groups: (body.results ?? []).map((g: any) => ({
      groupId: g.groupId, name: g.name, abbreviation: g.abbreviation ?? null,
      publishedOn: typeof g.publishedOn === 'string' ? g.publishedOn.slice(0, 10) : null,
    })),
  };
  return cache.groups;
}

/** Tests only. */
export function __clearTcgcsvGroupsCacheForTests() { cache = null; }

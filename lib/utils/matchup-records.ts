export interface MatchupRecord {
  wins: number;
  losses: number;
}

export interface ResultLike {
  opponentHero?: string | null;
  result: 'win' | 'loss';
}

export function computeMatchupRecords(
  results: ResultLike[]
): Record<string, MatchupRecord> {
  const records: Record<string, MatchupRecord> = {};
  for (const r of results) {
    if (!r.opponentHero) continue;
    const key = r.opponentHero.toLowerCase();
    if (!records[key]) records[key] = { wins: 0, losses: 0 };
    if (r.result === 'win') records[key].wins++;
    else if (r.result === 'loss') records[key].losses++;
  }
  return records;
}

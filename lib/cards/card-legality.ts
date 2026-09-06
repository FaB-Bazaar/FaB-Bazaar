/**
 * Per-format legality rows for one card, derived from the `cards.*_legal` /
 * `*_banned` / `*_suspended` / `ll_restricted` flags that the search API
 * surfaces on every printing row.
 *
 * Banned cards keep `*_legal = true` in the DB (verified: Art of War is
 * cc_legal AND cc_banned), so the restriction flags take precedence.
 */

export type LegalityStatus = 'legal' | 'not-legal' | 'banned' | 'suspended' | 'restricted';

export type LegalityKey = 'cc' | 'future_cc' | 'blitz' | 'll' | 'silver_age' | 'commoner';

export interface LegalityRow {
  key: LegalityKey;
  format: string;
  /** Compact label for the inline strip ("CC", "SA"). */
  short: string;
  status: LegalityStatus;
}

const FORMATS: Array<{ key: LegalityKey; format: string; short: string }> = [
  { key: 'cc', format: 'Classic Constructed', short: 'CC' },
  { key: 'blitz', format: 'Blitz', short: 'Blitz' },
  { key: 'll', format: 'Living Legend', short: 'LL' },
  { key: 'silver_age', format: 'Silver Age', short: 'SA' },
  { key: 'commoner', format: 'Commoner', short: 'Commoner' },
];

type Flags = Record<string, unknown>;

const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

/** Returns [] when the row carries no legality flags at all (nothing to show). */
export function formatLegalityRows(card: Flags): LegalityRow[] {
  const rows: LegalityRow[] = [];
  let any = false;
  for (const { key, format, short } of FORMATS) {
    const legal = asBool(card[`${key}_legal`]);
    const banned = asBool(card[`${key}_banned`]);
    const suspended = asBool(card[`${key}_suspended`]);
    const restricted = key === 'll' ? asBool(card.ll_restricted) : undefined;
    if (legal !== undefined || banned !== undefined || suspended !== undefined || restricted !== undefined) any = true;

    const status: LegalityStatus = banned
      ? 'banned'
      : suspended
        ? 'suspended'
        : restricted
          ? 'restricted'
          : legal
            ? 'legal'
            : 'not-legal';
    rows.push({ key, format, short, status });
  }
  return any ? rows : [];
}

/**
 * The row for the deck's format (`decks.format` display string, e.g.
 * "Silver Age"). Null when the format is unknown/limited or no legality data.
 */
export function deckLegalityVerdict(
  rows: LegalityRow[],
  deckFormat: string | undefined,
  card?: Flags,
): LegalityRow | null {
  if (!deckFormat) return null;
  const wanted = deckFormat.trim().toLowerCase();
  if (wanted === 'future classic constructed') {
    // Future CC is not a strip row of its own: it is the CC verdict, except a
    // card that isn't CC-legal yet but is printed in an unreleased set
    // (`future_release`, projected by the search API) counts as legal.
    const cc = rows.find((r) => r.key === 'cc');
    if (!cc) return null;
    const status: LegalityStatus =
      cc.status === 'not-legal' && asBool(card?.future_release) ? 'legal' : cc.status;
    return { key: 'future_cc', format: 'Future Classic Constructed', short: 'Future CC', status };
  }
  return rows.find((r) => r.format.toLowerCase() === wanted) ?? null;
}

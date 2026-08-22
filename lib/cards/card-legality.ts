/**
 * Per-format legality rows for one card, derived from the `cards.*_legal` /
 * `*_banned` / `*_suspended` / `ll_restricted` flags that the search API
 * surfaces on every printing row.
 *
 * Banned cards keep `*_legal = true` in the DB (verified: Art of War is
 * cc_legal AND cc_banned), so the restriction flags take precedence.
 */

export type LegalityStatus = 'legal' | 'not-legal' | 'banned' | 'suspended' | 'restricted';

export type LegalityKey = 'cc' | 'blitz' | 'll' | 'silver_age' | 'commoner';

export interface LegalityRow {
  key: LegalityKey;
  format: string;
  status: LegalityStatus;
}

const FORMATS: Array<{ key: LegalityKey; format: string }> = [
  { key: 'cc', format: 'Classic Constructed' },
  { key: 'blitz', format: 'Blitz' },
  { key: 'll', format: 'Living Legend' },
  { key: 'silver_age', format: 'Silver Age' },
  { key: 'commoner', format: 'Commoner' },
];

type Flags = Record<string, unknown>;

const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

/** Returns [] when the row carries no legality flags at all (nothing to show). */
export function formatLegalityRows(card: Flags): LegalityRow[] {
  const rows: LegalityRow[] = [];
  let any = false;
  for (const { key, format } of FORMATS) {
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
    rows.push({ key, format, status });
  }
  return any ? rows : [];
}

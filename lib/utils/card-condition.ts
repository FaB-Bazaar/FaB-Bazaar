/**
 * Card condition normalization.
 *
 * The `condition` Postgres enum only accepts short codes (see `conditionEnum`
 * in lib/postgres/schema.ts). UIs and imports sometimes send human-readable
 * labels ("Near Mint") instead of codes ("NM"); passing a label straight to
 * the DB throws `invalid input value for enum condition`, which silently fails
 * a per-card insert inside an otherwise-200 batch response. Normalize at the
 * service boundary so labels map to codes and unknown values are rejected
 * cleanly rather than crashing the query.
 */

export const CONDITION_CODES = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
export type ConditionCode = (typeof CONDITION_CODES)[number];

// Human-readable labels (and common variants) → enum code. Keys are lowercased.
const LABEL_TO_CODE: Record<string, ConditionCode> = {
  'near mint': 'NM',
  'lightly played': 'LP',
  'light play': 'LP',
  'moderately played': 'MP',
  'heavily played': 'HP',
  'damaged': 'DMG',
};

const CODE_SET = new Set<string>(CONDITION_CODES);

/**
 * Normalize a condition input to its enum code.
 * - Valid codes (case-insensitive) pass through.
 * - Known labels map to their code.
 * - Empty / missing input defaults to 'NM'.
 * - Unrecognized values return null (caller decides how to surface the error).
 */
export function normalizeCondition(input?: string | null): ConditionCode | null {
  const trimmed = (input ?? '').trim();
  if (trimmed === '') return 'NM';

  const upper = trimmed.toUpperCase();
  if (CODE_SET.has(upper)) return upper as ConditionCode;

  const byLabel = LABEL_TO_CODE[trimmed.toLowerCase()];
  return byLabel ?? null;
}

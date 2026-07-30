import { db } from '@/lib/postgres/db';
import { feedOverrides } from '@/lib/postgres/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';

/**
 * feed_overrides (migration 0095): manual corrections to the fab-cube feed,
 * applied by pipeline step 002 BEFORE price lookup so corrected tcgplayer ids
 * drive pricing, snapshots, and the nightly upsert.
 *
 * MUST stay in sync with ALLOWED_OVERRIDE_FIELDS in
 * pipeline/scripts/002_tcg_price_enhancer.py — the pipeline independently
 * whitelists on read, so a drifted key here would be silently ignored there.
 */
export const ALLOWED_FEED_OVERRIDE_FIELDS = [
  'tcgplayer_product_id',
  'tcgplayer_url',
  'tcgplayer_subtype_name',
] as const;

export interface FeedOverride {
  id: string;
  collectorNumber: string;
  edition: string | null;
  foiling: string | null;
  /** NULL = match any; [] = only no-variant printings; ['AA'] = exact set. */
  artVariations: string[] | null;
  language: string;
  setFields: Record<string, unknown>;
  reason: string;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeedOverrideInput {
  collectorNumber: string;
  edition?: string | null;
  foiling?: string | null;
  /**
   * Art-variation discriminator (migration 0096). The feed is 1:N on
   * (collector, edition, foiling) — art variants share the key. Omit/null to
   * match any variant (pre-0096 behaviour); [] to match only printings with
   * no variant; ['AA'] for an exact match. Stored uppercase + sorted.
   */
  artVariations?: string[] | null;
  language?: string;
  setFields: Record<string, unknown>;
  reason: string;
  createdBy?: string | null;
}

/** Match-key upsert input for the admin-PATCH auto-record path. */
export type UpsertFeedOverrideInput = CreateFeedOverrideInput;

/**
 * Normalize an artVariations input to its stored form, or report the error.
 * Returns `null` for wildcard (input omitted/null).
 */
function normalizeArtVariations(
  input: string[] | null | undefined
): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (input == null) return { ok: true, value: null };
  if (!Array.isArray(input) || input.some((v) => typeof v !== 'string')) {
    return { ok: false, error: 'artVariations must be an array of strings' };
  }
  const tokens = input.map((v) => v.trim().toUpperCase());
  if (tokens.some((v) => v === '')) {
    return { ok: false, error: 'artVariations tokens must be non-empty' };
  }
  return { ok: true, value: [...new Set(tokens)].sort() };
}

export interface UpdateFeedOverrideInput {
  setFields?: Record<string, unknown>;
  reason?: string;
  active?: boolean;
}

function validateSetFields(setFields: Record<string, unknown>): string | null {
  const keys = Object.keys(setFields);
  if (keys.length === 0) return 'setFields must contain at least one field';
  const invalid = keys.filter(
    (k) => !(ALLOWED_FEED_OVERRIDE_FIELDS as readonly string[]).includes(k)
  );
  if (invalid.length > 0) {
    return `setFields keys not allowed: ${invalid.join(', ')} (allowed: ${ALLOWED_FEED_OVERRIDE_FIELDS.join(', ')})`;
  }
  return null;
}

export class PostgresFeedOverridesService {
  async list(): AsyncResult<FeedOverride[]> {
    try {
      const rows = await db
        .select()
        .from(feedOverrides)
        .orderBy(desc(feedOverrides.createdAt));
      return { success: true, data: rows as FeedOverride[] };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to list feed overrides' };
    }
  }

  async create(input: CreateFeedOverrideInput): AsyncResult<FeedOverride> {
    const collectorNumber = input.collectorNumber?.trim().toUpperCase();
    if (!collectorNumber) {
      return { success: false, error: 'collectorNumber is required' };
    }
    if (!input.reason?.trim()) {
      return { success: false, error: 'reason is required' };
    }
    const fieldError = validateSetFields(input.setFields ?? {});
    if (fieldError) return { success: false, error: fieldError };
    const arts = normalizeArtVariations(input.artVariations);
    if (!arts.ok) return { success: false, error: arts.error };

    try {
      const rows = await db
        .insert(feedOverrides)
        .values({
          id: crypto.randomUUID(),
          collectorNumber,
          edition: input.edition?.trim().toUpperCase() || null,
          foiling: input.foiling?.trim().toUpperCase() || null,
          artVariations: arts.value,
          language: input.language?.trim().toLowerCase() || 'en',
          setFields: input.setFields,
          reason: input.reason.trim(),
          createdBy: input.createdBy ?? null,
        })
        .returning();
      return { success: true, data: rows[0] as FeedOverride };
    } catch (error: any) {
      if (error.message?.includes('unique_feed_override_match')) {
        return {
          success: false,
          error:
            'An override for this collector number / edition / foiling / art variations already exists',
        };
      }
      return { success: false, error: error.message || 'Failed to create feed override' };
    }
  }

  /**
   * Create-or-update by the unique match key (collector, edition, foiling,
   * language, artVariations). The admin printing-PATCH auto-record path: a
   * repeated manual fix updates the existing override in place (and
   * reactivates it) instead of failing the duplicate-key check.
   */
  async upsertByMatchKey(input: UpsertFeedOverrideInput): AsyncResult<FeedOverride> {
    const collectorNumber = input.collectorNumber?.trim().toUpperCase();
    if (!collectorNumber) {
      return { success: false, error: 'collectorNumber is required' };
    }
    const fieldError = validateSetFields(input.setFields ?? {});
    if (fieldError) return { success: false, error: fieldError };
    const arts = normalizeArtVariations(input.artVariations);
    if (!arts.ok) return { success: false, error: arts.error };

    const edition = input.edition?.trim().toUpperCase() || null;
    const foiling = input.foiling?.trim().toUpperCase() || null;
    const language = input.language?.trim().toLowerCase() || 'en';

    try {
      const existing = await db
        .select({ id: feedOverrides.id })
        .from(feedOverrides)
        .where(
          and(
            eq(sql`upper(${feedOverrides.collectorNumber})`, collectorNumber),
            eq(sql`upper(coalesce(${feedOverrides.edition}, ''))`, edition ?? ''),
            eq(sql`upper(coalesce(${feedOverrides.foiling}, ''))`, foiling ?? ''),
            eq(feedOverrides.language, language),
            arts.value === null
              ? isNull(feedOverrides.artVariations)
              : eq(feedOverrides.artVariations, arts.value)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const rows = await db
          .update(feedOverrides)
          .set({
            setFields: input.setFields,
            reason: input.reason.trim(),
            active: true,
            updatedAt: new Date(),
          })
          .where(eq(feedOverrides.id, existing[0].id))
          .returning();
        return { success: true, data: rows[0] as FeedOverride };
      }

      return this.create({ ...input, artVariations: arts.value });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to upsert feed override' };
    }
  }

  async update(id: string, patch: UpdateFeedOverrideInput): AsyncResult<FeedOverride> {
    if (patch.setFields !== undefined) {
      const fieldError = validateSetFields(patch.setFields);
      if (fieldError) return { success: false, error: fieldError };
    }
    try {
      const rows = await db
        .update(feedOverrides)
        .set({
          ...(patch.setFields !== undefined ? { setFields: patch.setFields } : {}),
          ...(patch.reason !== undefined ? { reason: patch.reason.trim() } : {}),
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(feedOverrides.id, id))
        .returning();
      if (rows.length === 0) {
        return { success: false, error: 'Feed override not found' };
      }
      return { success: true, data: rows[0] as FeedOverride };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update feed override' };
    }
  }

  async delete(id: string): AsyncResult<void> {
    try {
      await db.delete(feedOverrides).where(eq(feedOverrides.id, id));
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to delete feed override' };
    }
  }
}

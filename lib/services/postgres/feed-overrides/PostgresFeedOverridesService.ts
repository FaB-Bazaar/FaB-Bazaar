import { db } from '@/lib/postgres/db';
import { feedOverrides } from '@/lib/postgres/schema';
import { desc, eq } from 'drizzle-orm';
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
  language?: string;
  setFields: Record<string, unknown>;
  reason: string;
  createdBy?: string | null;
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

    try {
      const rows = await db
        .insert(feedOverrides)
        .values({
          id: crypto.randomUUID(),
          collectorNumber,
          edition: input.edition?.trim().toUpperCase() || null,
          foiling: input.foiling?.trim().toUpperCase() || null,
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
          error: 'An override for this collector number / edition / foiling already exists',
        };
      }
      return { success: false, error: error.message || 'Failed to create feed override' };
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

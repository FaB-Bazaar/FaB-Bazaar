import { db } from '@/lib/postgres/db';
import { printings, cards, foilMaskTemplates, foilMaskBulkOps } from '@/lib/postgres/schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';

/**
 * Foil-mask editing for the admin image-uploads screen (migration 0100).
 *
 * Two apply modes, with deliberately different overwrite rules:
 *
 *   applyToSelection — explicit printing_id list, OVERWRITES existing masks.
 *     The operator is looking at the exact cards on screen, so the blast radius
 *     is visible. This is also the only way to correct a bad bulk run: match
 *     mode skips rows that already have a mask, so without an overwriting mode
 *     a wrong sweep would be self-sealing.
 *
 *   applyToMatch — criteria sweep, writes ONLY to rows with no mask yet.
 *     Blast radius is potentially the whole catalogue, so it stays additive.
 *
 * Both modes always skip foil_inset_locked rows, and both record a
 * foil_mask_bulk_ops row carrying every affected printing's prior values so the
 * op can be undone wholesale.
 */

export interface FoilMaskValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
  round: string;
}

export interface FoilMaskTemplate extends FoilMaskValues {
  id: string;
  name: string;
  notes: string | null;
  sortOrder: number;
}

export interface FoilMaskMatchCriteria {
  /** Omit to sweep every set — the "apply globally" case. */
  set?: string | null;
  foiling: string;
  isExtendedArt?: boolean;
  /** Exact array match. Omit/null to match any variation. */
  artVariations?: string[] | null;
}

export interface FoilMaskPreview {
  wouldUpdate: number;
  skippedLocked: number;
  skippedAlreadySet: number;
  setCount: number;
  sample: Array<{ printingId: string; name: string; set: string; imageUrl: string | null }>;
}

export interface FoilMaskApplyResult {
  opId: string;
  updated: number;
  skippedLocked: number;
}

export interface FoilMaskBulkOp extends FoilMaskValues {
  id: string;
  kind: string;
  description: string;
  affectedCount: number;
  undoneAt: Date | null;
  createdAt: Date;
}

export interface ApplyOptions {
  description?: string;
  userId?: string | null;
}

/** One printing's mask before an op; nulls mean "had no mask". */
interface PriorValue {
  p: string;
  t: number | null;
  r: number | null;
  b: number | null;
  l: number | null;
  rd: string | null;
}

const SAMPLE_SIZE = 12;

/**
 * Drizzle wraps the pg driver error, so the constraint name lives on `cause`,
 * not on the top-level `message` (which is just the failed SQL). Walk the chain
 * rather than pattern-matching the wrapper's text.
 */
function isDuplicateTemplateName(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const candidate = e as { code?: string; constraint?: string };
    if (candidate.code === '23505' && candidate.constraint === 'ux_foil_mask_templates_name') {
      return true;
    }
  }
  return false;
}

function validateValues(values: FoilMaskValues): string | null {
  for (const field of ['top', 'right', 'bottom', 'left'] as const) {
    const v = values[field];
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 100) {
      return `${field} must be a number between 0 and 100`;
    }
  }
  if (typeof values.round !== 'string' || !values.round.trim() || values.round.length > 20) {
    return 'round must be a short CSS length string';
  }
  return null;
}

/** Conditions shared by preview and apply, minus the lock/unset filters. */
function matchConditions(criteria: FoilMaskMatchCriteria) {
  const conditions = [eq(printings.foiling, criteria.foiling.toLowerCase())];

  if (typeof criteria.set === 'string' && criteria.set) {
    conditions.push(eq(printings.set, criteria.set.toLowerCase()));
  }
  if (typeof criteria.isExtendedArt === 'boolean') {
    conditions.push(eq(printings.isExtendedArt, criteria.isExtendedArt));
  }
  // Exact array match so EA+AA only hits EA+AA rows, never EA-only.
  if (Array.isArray(criteria.artVariations)) {
    const sorted = [...criteria.artVariations].sort();
    conditions.push(
      sorted.length === 0
        ? sql`art_variations = ARRAY[]::text[]`
        : sql`art_variations = ARRAY[${sql.join(sorted.map(v => sql`${v}`), sql`, `)}]::text[]`
    );
  }
  return conditions;
}

export class PostgresFoilMaskService {
  // ---------------------------------------------------------------- preview

  async previewMatch(criteria: FoilMaskMatchCriteria): AsyncResult<FoilMaskPreview> {
    if (typeof criteria?.foiling !== 'string' || !criteria.foiling) {
      return { success: false, error: 'foiling is required' };
    }

    try {
      const base = matchConditions(criteria);

      const [counts] = await db
        .select({
          wouldUpdate: sql<number>`count(*) FILTER (WHERE NOT ${printings.foilInsetLocked} AND ${printings.foilInsetBottom} IS NULL)::int`,
          skippedLocked: sql<number>`count(*) FILTER (WHERE ${printings.foilInsetLocked})::int`,
          skippedAlreadySet: sql<number>`count(*) FILTER (WHERE NOT ${printings.foilInsetLocked} AND ${printings.foilInsetBottom} IS NOT NULL)::int`,
          setCount: sql<number>`count(DISTINCT ${printings.set}) FILTER (WHERE NOT ${printings.foilInsetLocked} AND ${printings.foilInsetBottom} IS NULL)::int`,
        })
        .from(printings)
        .where(and(...base));

      const sample = await db
        .select({
          printingId: printings.printingId,
          name: cards.displayName,
          set: printings.set,
          imageUrl: printings.imageUrl,
        })
        .from(printings)
        .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
        .where(and(...base, eq(printings.foilInsetLocked, false), isNull(printings.foilInsetBottom)))
        .orderBy(asc(printings.set), asc(printings.collectorNumber))
        .limit(SAMPLE_SIZE);

      return { success: true, data: { ...counts, sample } };
    } catch (error) {
      console.error('[FoilMaskService.previewMatch]', error);
      return { success: false, error: 'Failed to preview foil mask match' };
    }
  }

  // ------------------------------------------------------------------ apply

  async applyToSelection(
    printingIds: string[],
    values: FoilMaskValues,
    options: ApplyOptions
  ): AsyncResult<FoilMaskApplyResult> {
    if (!Array.isArray(printingIds) || printingIds.length === 0) {
      return { success: false, error: 'Select at least one printing' };
    }
    const invalid = validateValues(values);
    if (invalid) return { success: false, error: invalid };

    // Selection mode overwrites on purpose — see the class comment.
    return this.runApply({
      kind: 'selection',
      description: options.description ?? `${printingIds.length} selected printing${printingIds.length === 1 ? '' : 's'}`,
      targetWhere: and(
        inArray(printings.printingId, printingIds),
        eq(printings.foilInsetLocked, false)
      )!,
      lockedWhere: and(
        inArray(printings.printingId, printingIds),
        eq(printings.foilInsetLocked, true)
      )!,
      values,
      userId: options.userId ?? null,
    });
  }

  async applyToMatch(
    criteria: FoilMaskMatchCriteria,
    values: FoilMaskValues,
    options: ApplyOptions
  ): AsyncResult<FoilMaskApplyResult> {
    if (typeof criteria?.foiling !== 'string' || !criteria.foiling) {
      return { success: false, error: 'foiling is required' };
    }
    const invalid = validateValues(values);
    if (invalid) return { success: false, error: invalid };

    const base = matchConditions(criteria);
    const scope = criteria.set ? criteria.set.toUpperCase() : 'all sets';

    // Match mode is additive — never overwrite a mask that is already there.
    return this.runApply({
      kind: 'match',
      description: options.description ?? `${scope} · foiling ${criteria.foiling} (unset only)`,
      targetWhere: and(...base, eq(printings.foilInsetLocked, false), isNull(printings.foilInsetBottom))!,
      lockedWhere: and(...base, eq(printings.foilInsetLocked, true))!,
      values,
      userId: options.userId ?? null,
    });
  }

  /**
   * Snapshot → update → record, in one transaction so the audit row can never
   * disagree with what was actually written.
   */
  private async runApply(args: {
    kind: 'selection' | 'match';
    description: string;
    targetWhere: ReturnType<typeof and>;
    lockedWhere: ReturnType<typeof and>;
    values: FoilMaskValues;
    userId: string | null;
  }): AsyncResult<FoilMaskApplyResult> {
    const { kind, description, targetWhere, lockedWhere, values, userId } = args;
    const opId = `fmop-${crypto.randomUUID()}`;

    try {
      const result = await db.transaction(async tx => {
        const prior = await tx
          .select({
            p: printings.printingId,
            t: printings.foilInsetTop,
            r: printings.foilInsetRight,
            b: printings.foilInsetBottom,
            l: printings.foilInsetLeft,
            rd: printings.foilInsetRound,
          })
          .from(printings)
          .where(targetWhere);

        if (prior.length === 0) {
          const [{ locked }] = await tx
            .select({ locked: sql<number>`count(*)::int` })
            .from(printings)
            .where(lockedWhere);
          return { opId, updated: 0, skippedLocked: locked, empty: true };
        }

        await tx
          .update(printings)
          .set({
            foilInsetTop: values.top,
            foilInsetRight: values.right,
            foilInsetBottom: values.bottom,
            foilInsetLeft: values.left,
            foilInsetRound: values.round,
            updatedAt: new Date(),
          })
          .where(inArray(printings.printingId, prior.map(row => row.p)));

        const [{ locked }] = await tx
          .select({ locked: sql<number>`count(*)::int` })
          .from(printings)
          .where(lockedWhere);

        await tx.insert(foilMaskBulkOps).values({
          id: opId,
          kind,
          description,
          foilInsetTop: values.top,
          foilInsetRight: values.right,
          foilInsetBottom: values.bottom,
          foilInsetLeft: values.left,
          foilInsetRound: values.round,
          affectedCount: prior.length,
          priorValues: prior as PriorValue[],
          createdBy: userId,
        });

        return { opId, updated: prior.length, skippedLocked: locked, empty: false };
      });

      return { success: true, data: { opId: result.opId, updated: result.updated, skippedLocked: result.skippedLocked } };
    } catch (error) {
      console.error('[FoilMaskService.runApply]', error);
      return { success: false, error: 'Failed to apply foil mask' };
    }
  }

  // ------------------------------------------------------------------- undo

  async undoOp(opId: string): AsyncResult<{ opId: string; restored: number }> {
    if (typeof opId !== 'string' || !opId) {
      return { success: false, error: 'opId is required' };
    }

    try {
      return await db.transaction(async tx => {
        const [op] = await tx.select().from(foilMaskBulkOps).where(eq(foilMaskBulkOps.id, opId));
        if (!op) return { success: false as const, error: 'Bulk operation not found' };
        if (op.undoneAt) return { success: false as const, error: 'This operation was already undone' };

        const prior = op.priorValues as PriorValue[];

        if (prior.length > 0) {
          // One statement for the whole op — a per-row loop would be 11k
          // round-trips on a catalogue-wide sweep.
          const rows = sql.join(
            prior.map(
              v => sql`(${v.p}, ${v.t}::real, ${v.r}::real, ${v.b}::real, ${v.l}::real, ${v.rd}::text)`
            ),
            sql`, `
          );
          await tx.execute(sql`
            UPDATE printings AS p SET
              foil_inset_top = v.t,
              foil_inset_right = v.r,
              foil_inset_bottom = v.b,
              foil_inset_left = v.l,
              foil_inset_round = v.rd,
              updated_at = now()
            FROM (VALUES ${rows}) AS v(p, t, r, b, l, rd)
            WHERE p.printing_id = v.p
          `);
        }

        await tx
          .update(foilMaskBulkOps)
          .set({ undoneAt: new Date() })
          .where(eq(foilMaskBulkOps.id, opId));

        return { success: true as const, data: { opId, restored: prior.length } };
      });
    } catch (error) {
      console.error('[FoilMaskService.undoOp]', error);
      return { success: false, error: 'Failed to undo foil mask operation' };
    }
  }

  async listOps(limit = 20): AsyncResult<FoilMaskBulkOp[]> {
    try {
      const rows = await db
        .select({
          id: foilMaskBulkOps.id,
          kind: foilMaskBulkOps.kind,
          description: foilMaskBulkOps.description,
          top: foilMaskBulkOps.foilInsetTop,
          right: foilMaskBulkOps.foilInsetRight,
          bottom: foilMaskBulkOps.foilInsetBottom,
          left: foilMaskBulkOps.foilInsetLeft,
          round: foilMaskBulkOps.foilInsetRound,
          affectedCount: foilMaskBulkOps.affectedCount,
          undoneAt: foilMaskBulkOps.undoneAt,
          createdAt: foilMaskBulkOps.createdAt,
        })
        .from(foilMaskBulkOps)
        .orderBy(desc(foilMaskBulkOps.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));

      return { success: true, data: rows };
    } catch (error) {
      console.error('[FoilMaskService.listOps]', error);
      return { success: false, error: 'Failed to list foil mask operations' };
    }
  }

  // -------------------------------------------------------------- templates

  async listTemplates(): AsyncResult<FoilMaskTemplate[]> {
    try {
      const rows = await db
        .select({
          id: foilMaskTemplates.id,
          name: foilMaskTemplates.name,
          top: foilMaskTemplates.foilInsetTop,
          right: foilMaskTemplates.foilInsetRight,
          bottom: foilMaskTemplates.foilInsetBottom,
          left: foilMaskTemplates.foilInsetLeft,
          round: foilMaskTemplates.foilInsetRound,
          notes: foilMaskTemplates.notes,
          sortOrder: foilMaskTemplates.sortOrder,
        })
        .from(foilMaskTemplates)
        .orderBy(asc(foilMaskTemplates.sortOrder), asc(foilMaskTemplates.name));

      return { success: true, data: rows };
    } catch (error) {
      console.error('[FoilMaskService.listTemplates]', error);
      return { success: false, error: 'Failed to list foil mask templates' };
    }
  }

  async createTemplate(
    input: FoilMaskValues & { name: string; notes?: string | null; sortOrder?: number; userId?: string | null }
  ): AsyncResult<FoilMaskTemplate> {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) return { success: false, error: 'Template name is required' };
    if (name.length > 60) return { success: false, error: 'Template name must be 60 characters or fewer' };

    const invalid = validateValues(input);
    if (invalid) return { success: false, error: invalid };

    try {
      const id = `fmtpl-${crypto.randomUUID()}`;
      await db.insert(foilMaskTemplates).values({
        id,
        name,
        foilInsetTop: input.top,
        foilInsetRight: input.right,
        foilInsetBottom: input.bottom,
        foilInsetLeft: input.left,
        foilInsetRound: input.round,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 1000,
        createdBy: input.userId ?? null,
      });

      return {
        success: true,
        data: {
          id,
          name,
          top: input.top,
          right: input.right,
          bottom: input.bottom,
          left: input.left,
          round: input.round,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? 1000,
        },
      };
    } catch (error) {
      if (isDuplicateTemplateName(error)) {
        return { success: false, error: 'A template with that name already exists' };
      }
      console.error('[FoilMaskService.createTemplate]', error);
      return { success: false, error: 'Failed to create foil mask template' };
    }
  }

  async updateTemplate(
    id: string,
    patch: Partial<FoilMaskValues> & { name?: string; notes?: string | null; sortOrder?: number }
  ): AsyncResult<FoilMaskTemplate> {
    if (typeof id !== 'string' || !id) return { success: false, error: 'Template id is required' };

    const name = patch.name !== undefined ? String(patch.name).trim() : undefined;
    if (name !== undefined && !name) return { success: false, error: 'Template name is required' };

    try {
      await db
        .update(foilMaskTemplates)
        .set({
          name,
          foilInsetTop: patch.top,
          foilInsetRight: patch.right,
          foilInsetBottom: patch.bottom,
          foilInsetLeft: patch.left,
          foilInsetRound: patch.round,
          notes: patch.notes,
          sortOrder: patch.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(foilMaskTemplates.id, id));

      const [row] = await db
        .select({
          id: foilMaskTemplates.id,
          name: foilMaskTemplates.name,
          top: foilMaskTemplates.foilInsetTop,
          right: foilMaskTemplates.foilInsetRight,
          bottom: foilMaskTemplates.foilInsetBottom,
          left: foilMaskTemplates.foilInsetLeft,
          round: foilMaskTemplates.foilInsetRound,
          notes: foilMaskTemplates.notes,
          sortOrder: foilMaskTemplates.sortOrder,
        })
        .from(foilMaskTemplates)
        .where(eq(foilMaskTemplates.id, id));

      if (!row) return { success: false, error: 'Template not found' };
      return { success: true, data: row };
    } catch (error) {
      if (isDuplicateTemplateName(error)) {
        return { success: false, error: 'A template with that name already exists' };
      }
      console.error('[FoilMaskService.updateTemplate]', error);
      return { success: false, error: 'Failed to update foil mask template' };
    }
  }

  async deleteTemplate(id: string): AsyncResult<{ deleted: boolean }> {
    if (typeof id !== 'string' || !id) return { success: false, error: 'Template id is required' };
    try {
      const result = await db.delete(foilMaskTemplates).where(eq(foilMaskTemplates.id, id));
      return { success: true, data: { deleted: (result.rowCount ?? 0) > 0 } };
    } catch (error) {
      console.error('[FoilMaskService.deleteTemplate]', error);
      return { success: false, error: 'Failed to delete foil mask template' };
    }
  }
}

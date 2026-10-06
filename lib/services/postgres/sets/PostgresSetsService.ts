// lib/services/postgres/sets/PostgresSetsService.ts

import { db } from '@/lib/postgres/db';
import { sets, tcgGroupSets } from '@/lib/postgres/schema';
import type { SetFields } from '@/lib/sets/set-input';
import { asc, eq, inArray } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';
import type { ISetsService, SetDTO, SetUpdate, TcgGroupSetDTO } from '../../contracts/ISetsService';

function mapToSetDTO(row: typeof sets.$inferSelect): SetDTO {
  return {
    code: row.code,
    displayCode: row.displayCode,
    name: row.name,
    releaseDate: row.releaseDate,
    releaseOrder: row.releaseOrder,
    displayOrder: row.displayOrder,
    category: row.category as SetDTO['category'],
    tier: row.tier,
    isCore: row.isCore,
    hasFirstEdition: row.hasFirstEdition,
    unlimitedBeforeFirst: row.unlimitedBeforeFirst,
    defaultRarity: row.defaultRarity,
    imageId: row.imageId,
    inCardFilters: row.inCardFilters,
    legalFrom: row.legalFrom,
  };
}

export class PostgresSetsService implements ISetsService {
  async listSets(): AsyncResult<SetDTO[]> {
    try {
      const rows = await db.select().from(sets).orderBy(asc(sets.releaseOrder));
      return { success: true, data: rows.map(mapToSetDTO) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list sets' };
    }
  }

  async getSetByCode(code: string): AsyncResult<SetDTO | null> {
    try {
      const rows = await db
        .select()
        .from(sets)
        .where(eq(sets.code, code.toLowerCase()))
        .limit(1);

      return { success: true, data: rows.length > 0 ? mapToSetDTO(rows[0]) : null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get set' };
    }
  }

  async reorderSets(orders: Array<{ code: string; displayOrder: number }>): AsyncResult<{ updated: number }> {
    try {
      if (orders.length === 0) {
        return { success: false, error: 'orders must not be empty' };
      }
      const codes = orders.map((o) => o.code.toLowerCase());
      if (new Set(codes).size !== codes.length) {
        return { success: false, error: 'duplicate set codes in orders' };
      }
      const targets = orders.map((o) => o.displayOrder);
      if (new Set(targets).size !== targets.length) {
        return { success: false, error: 'duplicate displayOrder targets' };
      }
      if (targets.some((t) => !Number.isInteger(t) || t <= 0)) {
        return { success: false, error: 'displayOrder values must be positive integers' };
      }

      const found = await db.select({ code: sets.code }).from(sets).where(inArray(sets.code, codes));
      if (found.length !== codes.length) {
        const known = new Set(found.map((r) => r.code));
        const missing = codes.filter((c) => !known.has(c));
        return { success: false, error: `unknown set code(s): ${missing.join(', ')}` };
      }

      await db.transaction(async (tx) => {
        // Two-phase renumber: display_order is UNIQUE, so writing final values
        // directly can collide mid-flight (e.g. swapping two rows). Real values
        // are always positive, so negatives are a collision-free staging space.
        for (const o of orders) {
          await tx
            .update(sets)
            .set({ displayOrder: -o.displayOrder })
            .where(eq(sets.code, o.code.toLowerCase()));
        }
        for (const o of orders) {
          await tx
            .update(sets)
            .set({ displayOrder: o.displayOrder, updatedAt: new Date() })
            .where(eq(sets.code, o.code.toLowerCase()));
        }
      });

      return { success: true, data: { updated: orders.length } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder sets' };
    }
  }

  async registerSet(input: SetFields): AsyncResult<SetDTO> {
    try {
      const code = input.code.toLowerCase();
      const created = await db.transaction(async (tx) => {
        const [taken] = await tx.select({ code: sets.code }).from(sets).where(eq(sets.code, code)).limit(1);
        if (taken) return null;
        const all = await tx.select({ tier: sets.tier, releaseOrder: sets.releaseOrder, displayOrder: sets.displayOrder }).from(sets);
        const releaseOrder = Math.max(0, ...all.map((s) => s.releaseOrder)) + 1;
        const [row] = await tx.insert(sets).values({
          code,
          displayCode: input.displayCode,
          name: input.name,
          releaseDate: input.releaseDate,
          legalFrom: input.legalFrom,
          releaseOrder,
          displayOrder: nextDisplayOrder(all, input.tier),
          category: input.category,
          tier: input.tier,
          hasFirstEdition: input.hasFirstEdition,
          unlimitedBeforeFirst: input.unlimitedBeforeFirst,
          inCardFilters: input.inCardFilters,
        }).returning();
        if (input.tcgGroups.length) {
          await tx.insert(tcgGroupSets)
            .values(input.tcgGroups.map((g) => ({ groupId: g.groupId, setCode: code, setName: g.name })))
            .onConflictDoNothing();
        }
        return row;
      });
      if (!created) return { success: false, error: `set '${code}' is already registered` };
      return { success: true, data: mapToSetDTO(created) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to register set' };
    }
  }

  async updateSet(code: string, update: SetUpdate): AsyncResult<SetDTO> {
    try {
      const lc = code.toLowerCase();
      const { tcgGroups, ...fields } = update;
      const row = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(sets).where(eq(sets.code, lc)).limit(1);
        if (!current) return null;
        let next = current;
        if (Object.keys(fields).length) {
          [next] = await tx.update(sets).set({ ...fields, updatedAt: new Date() }).where(eq(sets.code, lc)).returning();
        }
        if (tcgGroups?.length) {
          await tx.insert(tcgGroupSets)
            .values(tcgGroups.map((g) => ({ groupId: g.groupId, setCode: lc, setName: g.name })))
            .onConflictDoNothing();
        }
        return next;
      });
      if (!row) return { success: false, error: `unknown set '${lc}'` };
      return { success: true, data: mapToSetDTO(row) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update set' };
    }
  }

  async listTcgGroupSets(): AsyncResult<TcgGroupSetDTO[]> {
    try {
      const rows = await db.select({ groupId: tcgGroupSets.groupId, setCode: tcgGroupSets.setCode, setName: tcgGroupSets.setName })
        .from(tcgGroupSets).orderBy(asc(tcgGroupSets.setCode), asc(tcgGroupSets.groupId));
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list TCGplayer groups' };
    }
  }
}

/**
 * display_order for a new set: right after the last set of its tier (printing
 * carousels sort tier 1 → 2 → 5 → 3 → 4 by this column), skipping values
 * already taken — the column is UNIQUE. Bounded; falls back to the very end.
 */
function nextDisplayOrder(all: Array<{ tier: number; displayOrder: number }>, tier: number): number {
  const taken = new Set(all.map((s) => s.displayOrder));
  const end = Math.max(0, ...all.map((s) => s.displayOrder)) + 1;
  const sameTier = all.filter((s) => s.tier === tier).map((s) => s.displayOrder);
  if (!sameTier.length) return end;
  let candidate = Math.max(...sameTier) + 1;
  for (let i = 0; i < 1000 && taken.has(candidate); i++) candidate++;
  return taken.has(candidate) ? end : candidate;
}

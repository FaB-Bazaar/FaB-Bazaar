// lib/services/postgres/sets/PostgresSetsService.ts

import { db } from '@/lib/postgres/db';
import { sets } from '@/lib/postgres/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';
import type { ISetsService, SetDTO } from '../../contracts/ISetsService';

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
}

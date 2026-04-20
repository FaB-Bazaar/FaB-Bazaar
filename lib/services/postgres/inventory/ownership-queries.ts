/**
 * Shared ownership-count queries used by both inventory and deck services.
 *
 * Pure functions over db — no service-level coupling, safe to import anywhere.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { inventoryItems, printings } from '@/lib/postgres/schema';

/**
 * Sum owned quantity per printingId for a user. Empty input → {}.
 */
export async function sumOwnedByPrintingId(
  userId: string,
  printingIds: string[],
): Promise<Record<string, number>> {
  if (printingIds.length === 0) return {};
  const rows = await db
    .select({
      printingId: inventoryItems.printingId,
      owned: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
    })
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.userId, userId),
      inArray(inventoryItems.printingId, printingIds),
    ))
    .groupBy(inventoryItems.printingId);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.printingId] = r.owned;
  return out;
}

/**
 * Sum forTrade quantity per printingId for a user. Empty input → {}.
 */
export async function sumForTradeByPrintingId(
  userId: string,
  printingIds: string[],
): Promise<Record<string, number>> {
  if (printingIds.length === 0) return {};
  const rows = await db
    .select({
      printingId: inventoryItems.printingId,
      forTrade: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,
    })
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.userId, userId),
      inArray(inventoryItems.printingId, printingIds),
    ))
    .groupBy(inventoryItems.printingId);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.printingId] = r.forTrade;
  return out;
}

/**
 * Sum owned quantity per cardUniqueId (any printing counts) for a user.
 * Empty input → {}.
 */
export async function sumOwnedByCardUniqueId(
  userId: string,
  cardUniqueIds: string[],
): Promise<Record<string, number>> {
  if (cardUniqueIds.length === 0) return {};
  const rows = await db
    .select({
      cardUniqueId: printings.cardUniqueId,
      owned: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
    })
    .from(inventoryItems)
    .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
    .where(and(
      eq(inventoryItems.userId, userId),
      inArray(printings.cardUniqueId, cardUniqueIds),
    ))
    .groupBy(printings.cardUniqueId);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.cardUniqueId] = r.owned;
  return out;
}

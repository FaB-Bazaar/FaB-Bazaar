/**
 * Shared ownership-count queries used by both inventory and deck services.
 *
 * Pure functions over db — no service-level coupling, safe to import anywhere.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { inventoryItems, printings, binders } from '@/lib/postgres/schema';

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

export interface BinderCardHit {
  binderId: string;
  name: string;
  slug: string | null;
  /** Copies of the card (any printing) in this binder. */
  quantity: number;
}

/**
 * Which of the user's binders hold any printing of each card, with the summed
 * quantity per binder, ordered by binder name. Cards the user owns nothing of
 * are absent from the map. Empty input → {}.
 */
export async function listBindersByCardUniqueId(
  userId: string,
  cardUniqueIds: string[],
): Promise<Record<string, BinderCardHit[]>> {
  if (cardUniqueIds.length === 0) return {};
  const rows = await db
    .select({
      cardUniqueId: printings.cardUniqueId,
      binderId: binders.id,
      name: binders.name,
      slug: binders.slug,
      quantity: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
    })
    .from(inventoryItems)
    .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
    .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
    .where(and(
      eq(inventoryItems.userId, userId),
      inArray(printings.cardUniqueId, cardUniqueIds),
    ))
    .groupBy(printings.cardUniqueId, binders.id, binders.name, binders.slug)
    .orderBy(binders.name, binders.id);

  const out: Record<string, BinderCardHit[]> = {};
  for (const r of rows) {
    (out[r.cardUniqueId] ??= []).push({ binderId: r.binderId, name: r.name, slug: r.slug ?? null, quantity: r.quantity });
  }
  return out;
}

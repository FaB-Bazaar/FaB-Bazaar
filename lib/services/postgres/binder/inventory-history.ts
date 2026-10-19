// Binder change history (inventory_operations, migration 0128).
//
// recordInventoryOperation is called INSIDE the transaction that changes the
// inventory, so history commits or rolls back with the change. Only items that
// actually changed are passed in; an action that changed nothing writes no row.

import { lt, sql, inArray, eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/postgres/db';
import { inventoryOperations, binders, printings, cards } from '@/lib/postgres/schema';

export const INVENTORY_HISTORY_RETENTION_DAYS = 30;
const PRUNE_BATCH_SIZE = 5000;

export type InventoryOperationKind = 'transfer';

export interface InventoryOperationItem {
  printingId: string;
  condition: string;
  language: string;
  quantity: number;
}

export interface ChangeHistoryItem extends InventoryOperationItem {
  name: string;
  pitch: number | null;
  collectorNumber: string | null;
  foiling: string | null;
  imageUrl: string | null;
}

export interface ChangeHistoryEntry {
  id: string;
  kind: InventoryOperationKind;
  createdAt: Date;
  /** null when the binder has since been deleted (or the action had no source/target) */
  sourceBinder: { id: string; name: string } | null;
  targetBinder: { id: string; name: string } | null;
  totalQuantity: number;
  items: ChangeHistoryItem[];
}

type DbOrTx = Pick<typeof db, 'insert'>;

export async function recordInventoryOperation(
  tx: DbOrTx,
  op: {
    userId: string;
    kind: InventoryOperationKind;
    sourceBinderId?: string | null;
    targetBinderId?: string | null;
  },
  items: InventoryOperationItem[]
): Promise<void> {
  if (items.length === 0) return;
  await tx.insert(inventoryOperations).values({
    id: uuidv4(),
    userId: op.userId,
    kind: op.kind,
    sourceBinderId: op.sourceBinderId ?? null,
    targetBinderId: op.targetBinderId ?? null,
    items,
  });
}

/** Delete history older than the retention window, in bounded batches. Returns rows deleted. */
export async function pruneInventoryOperations(): Promise<number> {
  const cutoff = sql`now() - make_interval(days => ${INVENTORY_HISTORY_RETENTION_DAYS})`;
  let total = 0;
  for (;;) {
    const batch = db
      .select({ id: inventoryOperations.id })
      .from(inventoryOperations)
      .where(lt(inventoryOperations.createdAt, cutoff))
      .limit(PRUNE_BATCH_SIZE);
    const deleted = await db
      .delete(inventoryOperations)
      .where(inArray(inventoryOperations.id, batch))
      .returning({ id: inventoryOperations.id });
    total += deleted.length;
    if (deleted.length < PRUNE_BATCH_SIZE) return total;
  }
}

/** A user's history, newest first, with binder and card names resolved. */
export async function listInventoryOperations(userId: string, limit = 200): Promise<ChangeHistoryEntry[]> {
  const ops = await db
    .select()
    .from(inventoryOperations)
    .where(eq(inventoryOperations.userId, userId))
    .orderBy(desc(inventoryOperations.createdAt))
    .limit(limit);
  if (ops.length === 0) return [];

  const binderIds = [...new Set(ops.flatMap((o) => [o.sourceBinderId, o.targetBinderId]).filter((id): id is string => !!id))];
  const printingIds = [...new Set(ops.flatMap((o) => (o.items as InventoryOperationItem[]).map((i) => i.printingId)))];

  const [binderRows, printingRows] = await Promise.all([
    binderIds.length
      ? db.select({ id: binders.id, name: binders.name }).from(binders).where(inArray(binders.id, binderIds))
      : Promise.resolve([]),
    db
      .select({
        printingId: printings.printingId,
        name: cards.displayName,
        pitch: cards.pitch,
        collectorNumber: printings.collectorNumber,
        foiling: printings.foiling,
        imageUrl: printings.imageUrl,
      })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(inArray(printings.printingId, printingIds)),
  ]);
  const binderById = new Map(binderRows.map((b) => [b.id, b]));
  const printingById = new Map(printingRows.map((p) => [p.printingId, p]));

  return ops.map((op) => {
    const items = (op.items as InventoryOperationItem[]).map((item) => {
      const p = printingById.get(item.printingId);
      return {
        ...item,
        name: p?.name ?? 'Unknown card',
        pitch: p?.pitch ?? null,
        collectorNumber: p?.collectorNumber ?? null,
        foiling: p?.foiling ?? null,
        imageUrl: p?.imageUrl ?? null,
      };
    });
    return {
      id: op.id,
      kind: op.kind as InventoryOperationKind,
      createdAt: op.createdAt,
      sourceBinder: (op.sourceBinderId && binderById.get(op.sourceBinderId)) || null,
      targetBinder: (op.targetBinderId && binderById.get(op.targetBinderId)) || null,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      items,
    };
  });
}

// Binder change history (inventory_operations, migration 0128).
//
// recordInventoryOperation is called INSIDE the transaction that changes the
// inventory, so history commits or rolls back with the change. Only items that
// actually changed are passed in; an action that changed nothing writes no row.

import { lt, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/postgres/db';
import { inventoryOperations } from '@/lib/postgres/schema';

export const INVENTORY_HISTORY_RETENTION_DAYS = 30;
const PRUNE_BATCH_SIZE = 5000;

export type InventoryOperationKind = 'transfer';

export interface InventoryOperationItem {
  printingId: string;
  condition: string;
  language: string;
  quantity: number;
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

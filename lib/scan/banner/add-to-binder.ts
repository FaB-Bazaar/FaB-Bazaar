// lib/scan/banner/add-to-binder.ts — /scan adds each card straight to a binder (no stage): one default binder at the
// top of the page (remembered between visits), an "Add to …" button per row, "Add all", and Undo, which takes back
// exactly the copies that row added (binderService.removeCopies on the inventory item the add reported).

export interface BinderOption { _id: string; name: string; slug?: string }
export interface AddedTo { binderId: string; binderName: string; inventoryItemId: string; quantity: number }

/** The binder used last time if it still exists, else the first one; null when the user has none. */
export function pickDefaultBinder<T extends BinderOption>(binders: T[], rememberedId: string | null): T | null {
  return binders.find(b => b._id === rememberedId) ?? binders[0] ?? null;
}

interface RowLike { id: string; name: string; status: string; printing: unknown; added?: unknown; adding?: boolean }

/** Rows "Add all" takes: sure of the card, matched to a printing, not added (or being added) yet. */
export function addableRowIds(rows: RowLike[]): string[] {
  return rows.filter(r => r.status === 'ok' && r.name && r.printing && !r.added && !r.adding).map(r => r.id);
}

interface AddResultLike {
  summary: { failed: number };
  results: Array<{ success: boolean; error?: string; quantityAdded?: number; inventoryItemId?: string }>;
}

/** One row's add-to-binder response -> what the row records (for "Added to … · Undo"), or why it failed. */
export function addedFromResult(res: AddResultLike, binder: BinderOption):
  { ok: true; added: AddedTo } | { ok: false; error: string } {
  const r = res.results[0];
  if (!r?.success || !r.inventoryItemId) return { ok: false, error: r?.error ?? 'Could not add the card' };
  return { ok: true, added: { binderId: binder._id, binderName: binder.name, inventoryItemId: r.inventoryItemId, quantity: r.quantityAdded ?? 1 } };
}

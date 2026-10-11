// lib/browse/binder-import-summary.ts — the "Import Successful!" toast text. The binder add summary counts ROWS
// (one per printing), so 10 copies over 7 printings read "7 cards added"; count the copies each row added instead.
interface AddResult { success: boolean; quantityAdded?: number }

export function binderImportSummary(data: { summary: { failed: number }; results: AddResult[] }): string {
  const copies = data.results.filter(r => r.success).reduce((n, r) => n + (r.quantityAdded ?? 1), 0);
  const added = `${copies} card${copies === 1 ? "" : "s"} added.`;
  return data.summary.failed > 0 ? `${added} ${data.summary.failed} couldn't be added.` : added;
}

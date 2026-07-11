// Rail-visibility rule for the desktop card-preview rail: the rail only earns
// its 16rem column once something on screen can actually be hovered. Kept as a
// pure function (structural subset of UiItem) so the rule is unit-testable
// away from the 3k-line chat component.

export interface PreviewableScanItem {
  kind: string;
  lines?: Array<string | { preview?: unknown }>;
  tableRows?: unknown[];
  tableSections?: Array<{ rows: unknown[] }>;
  cards?: unknown[];
}

/**
 * True once the conversation contains anything hover-previewable: a card
 * table, a deck card view, drill lines that carry previews, or AI-reply card
 * names harvested into the linkify index (`previewsByPidCount`).
 */
export function hasPreviewableContent(
  items: PreviewableScanItem[],
  previewsByPidCount: number,
): boolean {
  if (previewsByPidCount > 0) return true;
  return items.some((item) => {
    if (item.kind !== 'data') return false;
    if (item.tableRows?.length) return true;
    if (item.tableSections?.some((s) => s.rows.length > 0)) return true;
    if (item.cards?.length) return true;
    return item.lines?.some((line) => typeof line === 'object' && line.preview != null) ?? false;
  });
}

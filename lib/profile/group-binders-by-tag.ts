// lib/profile/group-binders-by-tag.ts
//
// Groups a user's public binders into tag sections for the profile page.
//
// Rules (see the design discussion):
//   - One section per distinct tag; a binder with multiple tags appears in each.
//   - Binders within a section are sorted by value (tcg_low) descending, so the
//     storefront's biggest binder leads.
//   - Sections are ordered by their total value descending.
//   - Untagged binders collapse into a single trailing section (tag === null),
//     always rendered last regardless of value, so it reads as the catch-all.
//   - When every binder is tagged, there is no untagged section.

export interface BinderSection<T> {
  /** The tag this section represents, or null for the trailing "untagged" group. */
  tag: string | null;
  binders: T[];
  totalValue: number;
  totalCards: number;
}

interface GroupableBinder {
  tags?: string[];
  totalValue?: { tcg_low?: number };
  total_value?: number;
  totalQuantity?: number;
  cardCount?: number;
  totalCards?: number;
}

const binderValue = (b: GroupableBinder): number =>
  Number(b.totalValue?.tcg_low) || Number(b.total_value) || 0;

const binderCards = (b: GroupableBinder): number =>
  Number(b.totalQuantity) || Number(b.cardCount) || Number(b.totalCards) || 0;

const cleanTags = (b: GroupableBinder): string[] =>
  (b.tags ?? []).map(t => t.trim()).filter(Boolean);

export function groupBindersByTag<T extends GroupableBinder>(binders: T[]): BinderSection<T>[] {
  const byTag = new Map<string, T[]>();
  const untagged: T[] = [];

  for (const binder of binders) {
    const tags = cleanTags(binder);
    if (tags.length === 0) {
      untagged.push(binder);
      continue;
    }
    for (const tag of tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(binder);
    }
  }

  const sortByValueDesc = (a: T, b: T) => binderValue(b) - binderValue(a);

  const toSection = (tag: string | null, group: T[]): BinderSection<T> => {
    const sorted = [...group].sort(sortByValueDesc);
    return {
      tag,
      binders: sorted,
      totalValue: sorted.reduce((sum, b) => sum + binderValue(b), 0),
      totalCards: sorted.reduce((sum, b) => sum + binderCards(b), 0),
    };
  };

  const tagSections = Array.from(byTag.entries())
    .map(([tag, group]) => toSection(tag, group))
    // Highest-value section first; tie-break alphabetically for determinism.
    .sort((a, b) => b.totalValue - a.totalValue || (a.tag! < b.tag! ? -1 : 1));

  if (untagged.length > 0) {
    tagSections.push(toSection(null, untagged));
  }

  return tagSections;
}

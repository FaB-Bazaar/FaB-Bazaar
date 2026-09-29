/**
 * Attributes for an article's `decklist-block` section → <fab-decklist-block>.
 * Shared by /articles/[publicId] and /heroes/[publicId]. A section may carry a
 * `snapshot` (the list frozen when the article was written); the block shows
 * it first and loads the live deck (`deckId`) only on request.
 */
export interface DecklistSection {
  type: 'decklist-block';
  deckId?: string;
  title?: string;
  sections?: string;
  exportUrl?: string;
  notes?: string;
  snapshot?: unknown;
}

export function decklistBlockAttrs(
  section: DecklistSection,
  owner: { articlePublicId?: string; heroPublicId?: string },
): Record<string, string | undefined> {
  return {
    'deck-id': section.deckId,
    'article-public-id': owner.articlePublicId,
    'hero-public-id': owner.heroPublicId,
    title: section.title || '',
    sections: section.sections,
    'export-url': section.exportUrl,
    notes: section.notes,
    snapshot: section.snapshot ? JSON.stringify(section.snapshot) : undefined,
  };
}

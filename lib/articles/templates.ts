// Article creation templates for the quick-write create page.
//
// A template = contentType + section skeleton. The writer's markdown from the
// quick-write box is embedded as the skeleton's text section; the rest are
// empty blocks the editor's section components fill in (same shapes the
// "Add Section" dropdown creates — bare { type } except where an editor
// expects a field to exist, e.g. card-carousel's cards array).

export type ArticleTemplateKey = 'blank' | 'tournament' | 'hero-guide';

export interface ArticleTemplate {
  key: ArticleTemplateKey;
  label: string;
  description: string;
  contentType: 'strategy' | 'tournament' | 'hero';
  buildSections: (content: string) => any[];
}

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    key: 'blank',
    label: 'Just Write',
    description: 'A blank page. Add cards, decklists and more later in the editor.',
    contentType: 'strategy',
    buildSections: (content) => (content.trim() ? [{ type: 'text', content }] : []),
  },
  {
    key: 'tournament',
    label: 'Tournament Report',
    description: 'Decklist, round-by-round match reports and key takeaways, ready to fill in.',
    contentType: 'tournament',
    buildSections: (content) => [
      { type: 'intro' },
      { type: 'text', content },
      { type: 'decklist-block' },
      { type: 'match-report' },
      { type: 'match-report' },
      { type: 'match-report' },
      { type: 'key-takeaways' },
    ],
  },
  {
    key: 'hero-guide',
    label: 'Hero Guide',
    description: 'Spotlight card, card carousel and key takeaways for a hero deep-dive.',
    contentType: 'hero',
    buildSections: (content) => [
      { type: 'intro' },
      { type: 'text', content },
      { type: 'spotlight-card' },
      { type: 'card-carousel', cards: [] },
      { type: 'key-takeaways' },
    ],
  },
];

export function buildTemplateArticle(
  key: ArticleTemplateKey,
  content: string
): { contentType: ArticleTemplate['contentType']; sections: any[] } {
  const template = ARTICLE_TEMPLATES.find((t) => t.key === key) ?? ARTICLE_TEMPLATES[0];
  return {
    contentType: template.contentType,
    sections: template.buildSections(content),
  };
}

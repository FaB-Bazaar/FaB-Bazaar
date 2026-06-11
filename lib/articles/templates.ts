// Article creation templates for the quick-write create page.
//
// A template = contentType + section skeleton. The writer's markdown from the
// quick-write box is embedded as the skeleton's text section; the rest are
// empty blocks the editor's section components fill in (same shapes the
// "Add Section" dropdown creates — bare { type } except where an editor
// expects a field to exist, e.g. card-carousel's cards array).

export type ArticleTemplateKey = 'blank' | 'tournament' | 'hero-guide';

export interface ArticleTemplateOptions {
  rounds?: number; // tournament only — event sizes vary
}

export interface ArticleTemplate {
  key: ArticleTemplateKey;
  label: string;
  description: string;
  contentType: 'strategy' | 'tournament' | 'hero';
  buildSections: (content: string, options?: ArticleTemplateOptions) => any[];
}

export const DEFAULT_ROUNDS = 6;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;

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
    buildSections: (content, options) => {
      const rounds = Math.min(
        MAX_ROUNDS,
        Math.max(MIN_ROUNDS, Math.floor(options?.rounds ?? DEFAULT_ROUNDS))
      );
      return [
        { type: 'intro' },
        { type: 'text', content },
        { type: 'section-header', title: 'Deck Tech', level: '2' },
        { type: 'decklist-block' },
        { type: 'section-header', title: 'Match Breakdown', level: '2' },
        ...Array.from({ length: rounds }, () => ({ type: 'match-report' })),
        { type: 'section-header', title: 'Closing Thoughts', level: '2' },
        { type: 'key-takeaways' },
      ];
    },
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
  content: string,
  options?: ArticleTemplateOptions
): { contentType: ArticleTemplate['contentType']; sections: any[] } {
  const template = ARTICLE_TEMPLATES.find((t) => t.key === key) ?? ARTICLE_TEMPLATES[0];
  return {
    contentType: template.contentType,
    sections: template.buildSections(content, options),
  };
}

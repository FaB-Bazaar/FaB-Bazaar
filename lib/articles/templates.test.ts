/**
 * Unit tests for article creation templates (quick-write create page).
 *
 * A template = contentType + section skeleton. The writer's markdown from the
 * quick-write box is embedded as the template's text section.
 */

import { describe, it, expect } from 'vitest';
import { ARTICLE_TEMPLATES, buildTemplateArticle } from './templates';

describe('ARTICLE_TEMPLATES', () => {
  it('offers blank, tournament and hero-guide templates', () => {
    const keys = ARTICLE_TEMPLATES.map(t => t.key);
    expect(keys).toContain('blank');
    expect(keys).toContain('tournament');
    expect(keys).toContain('hero-guide');
  });

  it('every template has a label and description for the picker UI', () => {
    for (const t of ARTICLE_TEMPLATES) {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });
});

describe('buildTemplateArticle', () => {
  it('blank: just the markdown as a single text section, strategy type', () => {
    const result = buildTemplateArticle('blank', '## Hello\n\nWorld');

    expect(result.contentType).toBe('strategy');
    expect(result.sections).toEqual([{ type: 'text', content: '## Hello\n\nWorld' }]);
  });

  it('blank: empty markdown produces no sections', () => {
    const result = buildTemplateArticle('blank', '   ');

    expect(result.sections).toEqual([]);
  });

  it('tournament: skeleton is intro → text → decklist → 3 match reports → takeaways', () => {
    const result = buildTemplateArticle('tournament', 'How the day went');

    expect(result.contentType).toBe('tournament');
    expect(result.sections.map(s => s.type)).toEqual([
      'intro',
      'text',
      'decklist-block',
      'match-report',
      'match-report',
      'match-report',
      'key-takeaways',
    ]);
    expect(result.sections[1]).toMatchObject({ type: 'text', content: 'How the day went' });
  });

  it('tournament: keeps the text slot even when markdown is empty', () => {
    const result = buildTemplateArticle('tournament', '');

    expect(result.sections.map(s => s.type)).toContain('text');
  });

  it('hero-guide: skeleton is intro → text → spotlight → carousel → takeaways, hero type', () => {
    const result = buildTemplateArticle('hero-guide', 'Why this hero rocks');

    expect(result.contentType).toBe('hero');
    expect(result.sections.map(s => s.type)).toEqual([
      'intro',
      'text',
      'spotlight-card',
      'card-carousel',
      'key-takeaways',
    ]);
  });

  it('card-carousel sections start with an empty cards array (editor contract)', () => {
    const result = buildTemplateArticle('hero-guide', 'x');

    const carousel = result.sections.find(s => s.type === 'card-carousel');
    expect(carousel).toMatchObject({ cards: [] });
  });

  it('unknown template falls back to blank', () => {
    const result = buildTemplateArticle('nope' as any, 'text');

    expect(result.contentType).toBe('strategy');
    expect(result.sections).toEqual([{ type: 'text', content: 'text' }]);
  });
});

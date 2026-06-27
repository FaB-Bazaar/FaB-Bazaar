import { describe, it, expect } from 'vitest';
import { renderCardGlossary, type CardMeta } from './renderCardGlossary';

const sink: CardMeta = {
  name: 'Sink Below',
  pitch: 1,
  typeText: 'Defense Reaction',
  defense: 3,
  keywords: ['Instant'],
  text: 'The next attack action card you play this turn gains +3{p}.',
};
const hot: CardMeta = { name: 'Hot Streak', pitch: 0, typeText: 'Action - Attack', cost: 0, power: 4, keywords: ['Go again'], text: 'If Hot Streak hits, draw a card.' };

describe('renderCardGlossary', () => {
  it('renders type, stats, keywords, and rules text per card', () => {
    const g = renderCardGlossary([sink, hot]);
    expect(g).toMatch(/Card glossary/i);
    expect(g).toContain('Sink Below (red) — Defense Reaction · def 3 · [Instant]');
    expect(g).toContain('The next attack action card');
    expect(g).toContain('Hot Streak — Action - Attack · cost 0 · pwr 4 · [Go again]');
  });

  it('dedupes by name+pitch', () => {
    const g = renderCardGlossary([sink, { ...sink }, hot]);
    const sinkLines = g.split('\n').filter((l) => l.includes('Sink Below'));
    expect(sinkLines).toHaveLength(1);
  });

  it('keeps same-name different-pitch cards as separate entries', () => {
    const g = renderCardGlossary([
      { name: 'Blade Runner', pitch: 1, typeText: 'Action - Attack' },
      { name: 'Blade Runner', pitch: 3, typeText: 'Action - Attack' },
    ]);
    expect(g.split('\n').filter((l) => l.includes('Blade Runner'))).toHaveLength(2);
  });

  it('returns empty string when there is nothing to show', () => {
    expect(renderCardGlossary([])).toBe('');
  });

  it('merges the player note onto the matching card line (joined, not separate)', () => {
    const g = renderCardGlossary([sink, hot], { 'sink below|1': 'block vs aggro' });
    expect(g).toMatch(/Sink Below \(red\).*📝 your note: block vs aggro/);
    // a card without a note gets no marker
    const hotLine = g.split('\n').find((l) => l.includes('Hot Streak'))!;
    expect(hotLine).not.toContain('your note');
  });
});

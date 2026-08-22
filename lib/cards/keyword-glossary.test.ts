import { describe, it, expect } from 'vitest';
import { keywordGlossary } from './keyword-glossary';
import { KEYWORD_REMINDERS, lookupKeywordReminder } from '@/lib/fab-constants/keyword-reminders';

describe('lookupKeywordReminder', () => {
  it('normalises case and strips a trailing magnitude (Ward 10, Arcane Barrier X)', () => {
    expect(lookupKeywordReminder('Ward 10')).toEqual({ keyword: 'Ward', key: 'ward', reminder: KEYWORD_REMINDERS['ward'] });
    expect(lookupKeywordReminder('arcane barrier X')?.keyword).toBe('Arcane Barrier');
    expect(lookupKeywordReminder('GO AGAIN')?.keyword).toBe('Go Again');
  });

  it('returns null for words that are not keywords', () => {
    expect(lookupKeywordReminder('attack')).toBeNull();
    expect(lookupKeywordReminder('')).toBeNull();
  });
});

describe('keywordGlossary', () => {
  // Ancestral Harmony's rendered text: combo is referenced (bold) but the card
  // doesn't *have* combo; go again is both bold and in the keywords array.
  const AH_TEXT = 'Your attacks with **combo** get +1{p} this turn.{br}Banish the top card of your deck. If it has **combo**, you may play it this turn.{br}**Go again**';

  it('collects bolded keywords in text order plus the keywords array, once each', () => {
    const g = keywordGlossary(AH_TEXT, ['go again']);
    expect(g.map(e => e.keyword)).toEqual(['Combo', 'Go Again']);
    expect(g[1].reminder).toBe(KEYWORD_REMINDERS['go again']);
  });

  it('skips a keyword whose reminder text the card already prints inline', () => {
    const text = '**Ward 10** _(If you would be dealt damage, destroy this to prevent 10 of that damage.)_';
    expect(keywordGlossary(text, ['ward 10'])).toEqual([]);
  });

  it('ignores bold runs that are not keywords and handles empty input', () => {
    expect(keywordGlossary('**Once per Turn Action** - {r}: Draw a card.', [])).toEqual([]);
    expect(keywordGlossary('', [])).toEqual([]);
  });
});

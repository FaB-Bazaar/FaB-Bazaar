/**
 * parseRulesText — turns rendered FaB rules text (card_translations.text via
 * the search API's `text` field) into paragraphs of typed segments the UI can
 * map to JSX: plain text, **bold**, _italic_, and {x} glyph tokens, with
 * {br} (and raw newlines) as paragraph breaks.
 */

import { describe, it, expect } from 'vitest';
import { parseRulesText } from './rules-text';

describe('parseRulesText', () => {
  it('splits paragraphs on {br} and extracts bold + tokens', () => {
    const text =
      'When this attacks a hero, if you have more {g} than them, **the crowd boos** you.{br}If you’ve been booed this turn, this gets +4{p}.';
    const paras = parseRulesText(text);
    expect(paras).toHaveLength(2);
    expect(paras[0]).toEqual([
      { type: 'text', value: 'When this attacks a hero, if you have more ' },
      { type: 'icon', token: 'g' },
      { type: 'text', value: ' than them, ' },
      { type: 'bold', children: [{ type: 'text', value: 'the crowd boos' }] },
      { type: 'text', value: ' you.' },
    ]);
    expect(paras[1]).toEqual([
      { type: 'text', value: 'If you’ve been booed this turn, this gets +4' },
      { type: 'icon', token: 'p' },
      { type: 'text', value: '.' },
    ]);
  });

  it('parses italic reminder text', () => {
    const paras = parseRulesText('_(You may only have 1 Singularity in your deck.)_');
    expect(paras).toEqual([
      [{ type: 'italic', children: [{ type: 'text', value: '(You may only have 1 Singularity in your deck.)' }] }],
    ]);
  });

  it('keeps tokens inside bold segments', () => {
    const paras = parseRulesText('**Instant** -- {r}{r}: draw a card.');
    expect(paras).toEqual([
      [
        { type: 'bold', children: [{ type: 'text', value: 'Instant' }] },
        { type: 'text', value: ' -- ' },
        { type: 'icon', token: 'r' },
        { type: 'icon', token: 'r' },
        { type: 'text', value: ': draw a card.' },
      ],
    ]);
  });

  it('passes plain text through untouched and treats newlines as breaks', () => {
    expect(parseRulesText('Go again\nDominate')).toEqual([
      [{ type: 'text', value: 'Go again' }],
      [{ type: 'text', value: 'Dominate' }],
    ]);
  });

  it('returns no paragraphs for empty text', () => {
    expect(parseRulesText('')).toEqual([]);
    expect(parseRulesText('  ')).toEqual([]);
  });
});

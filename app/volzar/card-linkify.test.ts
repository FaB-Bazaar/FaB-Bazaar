import { describe, it, expect } from 'vitest';
import {
  normalizeCardName,
  buildCardNameIndex,
  pickPreview,
  splitTextByCardNames,
  rehypeLinkifyCards,
} from './card-linkify';
import type { CardPreview } from './quick-actions';

const preview = (name: string, printingId: string): CardPreview => ({
  imageUrl: `https://img/${printingId}.webp`,
  name,
  printingId,
  priceLow: 0.1,
});

describe('normalizeCardName', () => {
  it('lowercases, trims, and normalizes curly apostrophes to straight', () => {
    expect(normalizeCardName('  Warrior’s Valor ')).toBe("warrior's valor");
    expect(normalizeCardName("Warrior's Valor")).toBe("warrior's valor");
  });
});

describe('buildCardNameIndex', () => {
  it('groups multiple pitch variants of one name into one key', () => {
    const index = buildCardNameIndex([
      { name: 'Zero to Sixty', pitch: 1, preview: preview('Zero to Sixty', 'z-red') },
      { name: 'Zero to Sixty', pitch: 2, preview: preview('Zero to Sixty', 'z-yellow') },
      { name: 'Zero to Sixty', pitch: 3, preview: preview('Zero to Sixty', 'z-blue') },
    ]);
    expect(index.get('zero to sixty')).toHaveLength(3);
  });

  it('dedupes repeated printingIds', () => {
    const index = buildCardNameIndex([
      { name: 'Heist', pitch: 1, preview: preview('Heist', 'h1') },
      { name: 'Heist', pitch: 1, preview: preview('Heist', 'h1') },
    ]);
    expect(index.get('heist')).toHaveLength(1);
  });
});

describe('pickPreview', () => {
  const entries = [
    { pitch: 3, preview: preview('Zero to Sixty', 'z-blue') },
    { pitch: 1, preview: preview('Zero to Sixty', 'z-red') },
    { pitch: 2, preview: preview('Zero to Sixty', 'z-yellow') },
  ];
  it('defaults to the lowest pitch (red) representative', () => {
    expect(pickPreview(entries).printingId).toBe('z-red');
  });
});

describe('splitTextByCardNames', () => {
  const index = buildCardNameIndex([
    { name: 'Heist', pitch: 1, preview: preview('Heist', 'h1') },
    { name: 'Rev Up', pitch: 1, preview: preview('Rev Up', 'r1') },
    { name: "Warrior's Valor", pitch: 1, preview: preview("Warrior's Valor", 'w1') },
    { name: 'Command', pitch: 1, preview: preview('Command', 'c1') },
    { name: 'Command and Conquer', pitch: 1, preview: preview('Command and Conquer', 'cnc1') },
  ]);

  it('wraps a matched card name and leaves surrounding text as plain segments', () => {
    const segs = splitTextByCardNames('I like Heist a lot', index);
    expect(segs.map((s) => s.value).join('')).toBe('I like Heist a lot');
    const linked = segs.filter((s) => s.preview);
    expect(linked).toHaveLength(1);
    expect(linked[0].value).toBe('Heist');
    expect(linked[0].preview?.printingId).toBe('h1');
  });

  it('matches names the model writes with exotic spaces (NNBSP/NBSP) — gpt-oss emits U+202F in tables', () => {
    // Live repro: "Rev\u202FUp" renders identically to "Rev Up" but never
    // linkified — the summarized-table linkify appeared randomly broken
    // depending on which space codepoint the model emitted that day.
    const nnbspText = 'Try Rev\u202FUp here';
    const segs = splitTextByCardNames(nnbspText, index);
    expect(segs.map((s) => s.value).join('')).toBe(nnbspText); // original text preserved
    const linked = segs.filter((s) => s.preview);
    expect(linked).toHaveLength(1);
    expect(linked[0].value).toBe('Rev\u202FUp');
    expect(linked[0].preview?.printingId).toBe('r1');

    const nbsp = splitTextByCardNames('Rev\u00A0Up', index).filter((s) => s.preview);
    expect(nbsp).toHaveLength(1);
  });

  it('normalizeCardName folds exotic spaces so index keys align', () => {
    expect(normalizeCardName('Rev\u202FUp')).toBe('rev up');
    expect(normalizeCardName('Rev\u00A0Up')).toBe('rev up');
  });

  it('does not match a name embedded inside a larger word', () => {
    const segs = splitTextByCardNames('the Heister strikes', index);
    expect(segs.some((s) => s.preview)).toBe(false);
  });

  it('prefers the longest matching name (Command and Conquer over Command)', () => {
    const segs = splitTextByCardNames('play Command and Conquer now', index);
    const linked = segs.filter((s) => s.preview);
    expect(linked).toHaveLength(1);
    expect(linked[0].value).toBe('Command and Conquer');
    expect(linked[0].preview?.printingId).toBe('cnc1');
  });

  it('matches names with apostrophes regardless of straight/curly quote', () => {
    const segs = splitTextByCardNames('run ‘Warrior’s Valor’ here', index);
    const linked = segs.filter((s) => s.preview);
    expect(linked).toHaveLength(1);
    expect(linked[0].preview?.printingId).toBe('w1');
    // original text preserved exactly (curly quotes intact) when rejoined
    expect(segs.map((s) => s.value).join('')).toBe('run ‘Warrior’s Valor’ here');
  });

  it('returns a single plain segment when nothing matches', () => {
    const segs = splitTextByCardNames('no cards mentioned', index);
    expect(segs).toEqual([{ value: 'no cards mentioned' }]);
  });

  it('matches multiple names in one string', () => {
    const segs = splitTextByCardNames('Heist and Rev Up', index);
    expect(segs.filter((s) => s.preview).map((s) => s.value)).toEqual(['Heist', 'Rev Up']);
  });
});

describe('rehypeLinkifyCards', () => {
  const index = buildCardNameIndex([
    { name: 'Heist', pitch: 1, preview: preview('Heist', 'h1') },
  ]);
  const cardref = (node: any): any[] => {
    const out: any[] = [];
    const walk = (n: any) => {
      if (n?.type === 'element' && n.tagName === 'cardref') out.push(n);
      (n?.children ?? []).forEach(walk);
    };
    walk(node);
    return out;
  };

  it('replaces a card name in a paragraph text node with a cardref element carrying its printingId', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'element', tagName: 'p', children: [{ type: 'text', value: 'play Heist now' }] }],
    };
    rehypeLinkifyCards(index)(tree);
    const refs = cardref(tree);
    expect(refs).toHaveLength(1);
    expect(refs[0].children[0].value).toBe('Heist');
    expect(refs[0].properties.dataPid).toBe('h1');
  });

  it('does not linkify inside code or pre blocks', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'pre', children: [
          { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'Heist' }] },
        ] },
      ],
    };
    rehypeLinkifyCards(index)(tree);
    expect(cardref(tree)).toHaveLength(0);
  });

  it('linkifies names inside table cells and bold', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'element', tagName: 'td', children: [
        { type: 'element', tagName: 'strong', children: [{ type: 'text', value: 'Heist' }] },
      ] }],
    };
    rehypeLinkifyCards(index)(tree);
    expect(cardref(tree)).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { buildCommentaryHtml, editionLabel, rarityLabel } from './spotlight-commentary';

// The commentary from the live "Farewell to Dash, Hello to Maxx" article.
const COMMENTARY = `**Hyper Driver** is often a liability in the deck. I tried playing Nitro Mechanoid Dash for quite some time.

Assembly Module adds blues to your deck, can come back from **Heist** and if you're able to play it without cranking can result in some very lopsided games.

My favorite way to cheat them into play without the action point is with **Cogwerx Base Legs**. Most players typically reserve this precious steam resource for an extra swing with their **Construct Nitro Mechanoid**, but I really like using it with **Assembly Module**.`;

const img = (name: string) => ({ image_url: `https://img.example/${encodeURIComponent(name)}/public` });
const ALL = new Map(['Hyper Driver', 'Heist', 'Cogwerx Base Legs', 'Construct Nitro Mechanoid', 'Assembly Module'].map(n => [n, img(n)]));
const paragraphs = (html: string) => html.match(/<p>[\s\S]*?<\/p>/g) ?? [];

describe('buildCommentaryHtml', () => {
  it('keeps each paragraph whole — a card mention never splits its paragraph', () => {
    const html = buildCommentaryHtml(COMMENTARY, ALL, new Set());
    const ps = paragraphs(html);
    expect(ps).toHaveLength(3);
    expect(ps[1]).toMatch(/^<p>Assembly Module adds blues[\s\S]*data-card-name="Heist"[\s\S]*lopsided games\.<\/p>$/);
    expect(ps[2]).toContain('data-card-name="Cogwerx Base Legs"');
    expect(ps[2]).toContain('data-card-name="Assembly Module"');
  });

  it('puts no space between a mention and the punctuation after it', () => {
    const html = buildCommentaryHtml(COMMENTARY, ALL, new Set());
    expect(html).toMatch(/Cogwerx Base Legs<\/span><\/span>\./);
    expect(html).toMatch(/Construct Nitro Mechanoid<\/span><\/span>, but/);
    expect(html).toMatch(/with <span class="inline-card-wrapper"/);
  });

  it('a mention with an image is a clickable thumbnail + name carrying its image url', () => {
    const html = buildCommentaryHtml('**Heist** rules.', ALL, new Set());
    expect(html).toContain('data-card-img="https://img.example/Heist/public"');
    expect(html).toContain('<img class="inline-card-thumbnail" src="https://img.example/Heist/public" alt="Heist"');
    expect(html).toContain('role="button"');
  });

  it('loading and unknown mentions fall back without breaking the text', () => {
    expect(buildCommentaryHtml('**Heist** x', new Map(), new Set(['Heist']))).toContain('<span class="inline-card-loading"></span>');
    expect(buildCommentaryHtml('**Heist** x', new Map(), new Set())).toContain('<span class="card-mention">Heist</span> x');
  });

  it('leaves lowercase bold as bold and escapes a mention name', () => {
    expect(buildCommentaryHtml('this is **really** good', ALL, new Set())).toContain('<strong>really</strong>');
    const html = buildCommentaryHtml('**Evil <Script>**', new Map(), new Set());
    expect(html).toContain('Evil &lt;Script&gt;');
    expect(html).not.toContain('<Script>');
  });
});

describe('spotlight meta labels', () => {
  it('Normal edition shows nothing; others get words', () => {
    expect(editionLabel('N')).toBe('');
    expect(editionLabel('n')).toBe('');
    expect(editionLabel('F')).toBe('1st Edition');
    expect(editionLabel('A')).toBe('Alpha');
    expect(editionLabel('U')).toBe('Unlimited');
  });

  it('rarity codes read as words, matching the site labels', () => {
    expect(rarityLabel('R')).toBe('Rare');
    expect(rarityLabel('m')).toBe('Majestic');
    expect(rarityLabel('V')).toBe('Marvel');
    expect(rarityLabel('')).toBe('');
  });
});

// Integration test in the same style as card-linkify.pipeline.test.ts: run the
// real remark→rehype pipeline, apply rehypeRuleGlyphs, and assert FaB rules
// tokens ({p} power, {d} defense, {r} resource, {h} life, {i} intellect) in
// the model's markdown become `ruleicon` elements — including inside GFM table
// cells, where quoted card text mostly lives. Literal <br> (the model's
// table-cell line-break trick, shown as text without rehype-raw) becomes a
// real <br> element. Pure tree work, no React.
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { rehypeRuleGlyphs } from './rule-glyphs';

async function toGlyphTree(markdown: string) {
  const tree = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Mirror react-markdown: raw inline HTML survives as `raw` hast nodes
    // (rendered as literal text unless a plugin like ours converts them).
    .use(remarkRehype, { allowDangerousHtml: true })
    .run(unified().use(remarkParse).use(remarkGfm).parse(markdown));
  rehypeRuleGlyphs()(tree);
  return tree;
}

function collect(tree: any, tagName: string): any[] {
  const out: any[] = [];
  const walk = (n: any) => {
    if (n?.type === 'element' && n.tagName === tagName) out.push(n);
    (n?.children ?? []).forEach(walk);
  };
  walk(tree);
  return out;
}

function textOf(tree: any): string {
  let s = '';
  const walk = (n: any) => {
    if (n?.type === 'text') s += n.value;
    (n?.children ?? []).forEach(walk);
  };
  walk(tree);
  return s;
}

describe('rehypeRuleGlyphs in the real remark/rehype pipeline', () => {
  it('swaps {p}/{d}/{r} tokens in prose for ruleicon elements', async () => {
    const tree = await toGlyphTree('Target attack gains +1{p} and +2{d}. Gain {r}{r}.');
    const icons = collect(tree, 'ruleicon');
    expect(icons.map((i) => i.properties.dataToken)).toEqual(['p', 'd', 'r', 'r']);
    // The surrounding text survives with the tokens removed.
    expect(textOf(tree)).toBe('Target attack gains +1 and +2. Gain .');
  });

  it('works inside GFM table cells', async () => {
    const md = ['| Card | Effect |', '|------|--------|', '| Maul | gets +3{p} |'].join('\n');
    const icons = collect(await toGlyphTree(md), 'ruleicon');
    expect(icons).toHaveLength(1);
    expect(icons[0].properties.dataToken).toBe('p');
  });

  it('turns literal <br> text into a real br element', async () => {
    const md = ['| Effect |', '|--------|', '| Choose 1:<br>• Target dagger gains +3{p}. |'].join('\n');
    const tree = await toGlyphTree(md);
    expect(collect(tree, 'br')).toHaveLength(1);
    expect(textOf(tree)).not.toContain('<br>');
  });

  it('leaves unknown tokens and code blocks untouched', async () => {
    const tree = await toGlyphTree('A {z} token.\n\n```\n+1{p}\n```');
    expect(collect(tree, 'ruleicon')).toHaveLength(0);
    expect(textOf(tree)).toContain('{z}');
    expect(textOf(tree)).toContain('+1{p}');
  });
});

describe('pitch notation (pN) → pitch pip icons', () => {
  it('swaps (p1)/(p2)/(p3) for pitchicon elements, removing the notation text', async () => {
    const tree = await toGlyphTree('Command and Conquer (p1), Pulsewave Protocol (p2), Ripple Away (p3).');
    const pips = collect(tree, 'pitchicon');
    expect(pips.map((i) => i.properties.dataPitch)).toEqual([1, 2, 3]);
    expect(textOf(tree)).toBe('Command and Conquer , Pulsewave Protocol , Ripple Away .');
  });

  it('works inside GFM table cells and is case-insensitive', async () => {
    const md = ['| Card | Qty |', '|------|-----|', '| Fate Foreseen (P1) | 3 |'].join('\n');
    const pips = collect(await toGlyphTree(md), 'pitchicon');
    expect(pips).toHaveLength(1);
    expect(pips[0].properties.dataPitch).toBe(1);
  });

  it('ignores non-pitch parentheticals and bare pN text', async () => {
    const tree = await toGlyphTree('See (p4) and (page 1) and p1 alone and (p12).');
    expect(collect(tree, 'pitchicon')).toHaveLength(0);
    expect(textOf(tree)).toContain('(p4)');
    expect(textOf(tree)).toContain('(p12)');
    expect(textOf(tree)).toContain('p1 alone');
  });
});

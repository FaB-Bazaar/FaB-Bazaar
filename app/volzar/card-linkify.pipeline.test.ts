// Integration test: runs the SAME remark→rehype pipeline react-markdown uses
// internally (remark-parse → remark-gfm → remark-rehype), then applies our
// rehype plugin, and asserts card names in real parsed markdown (prose, GFM
// tables, bold) become `cardref` elements. No React / jsdom — pure tree work.
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { buildCardNameIndex, rehypeLinkifyCards } from './card-linkify';
import type { CardPreview } from './quick-actions';

const preview = (name: string, id: string): CardPreview => ({
  imageUrl: `https://img/${id}.webp`,
  name,
  printingId: id,
  priceLow: 1,
});

const index = buildCardNameIndex([
  { name: 'Heist', pitch: 1, preview: preview('Heist', 'h1') },
  { name: 'Rev Up', pitch: 1, preview: preview('Rev Up', 'r1') },
]);

async function toLinkedTree(markdown: string) {
  const tree = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .run(unified().use(remarkParse).use(remarkGfm).parse(markdown));
  rehypeLinkifyCards(index)(tree);
  return tree;
}

function cardrefs(tree: any): any[] {
  const out: any[] = [];
  const walk = (n: any) => {
    if (n?.type === 'element' && n.tagName === 'cardref') out.push(n);
    (n?.children ?? []).forEach(walk);
  };
  walk(tree);
  return out;
}

describe('rehypeLinkifyCards in the real remark/rehype pipeline', () => {
  it('linkifies a card name in prose', async () => {
    const refs = cardrefs(await toLinkedTree('Try **Heist** for value.'));
    expect(refs).toHaveLength(1);
    expect(refs[0].properties.dataPid).toBe('h1');
    expect(refs[0].children[0].value).toBe('Heist');
  });

  it('linkifies card names inside a GFM table', async () => {
    const md = ['| Card | Cost |', '|------|------|', '| **Heist** | 2 |', '| Rev Up | 2 |'].join('\n');
    const refs = cardrefs(await toLinkedTree(md));
    const pids = refs.map((r) => r.properties.dataPid).sort();
    expect(pids).toEqual(['h1', 'r1']);
  });

  it('does not linkify inside fenced code blocks', async () => {
    const md = ['```', 'Heist', '```'].join('\n');
    expect(cardrefs(await toLinkedTree(md))).toHaveLength(0);
  });
});

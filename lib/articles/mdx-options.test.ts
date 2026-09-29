import { describe, it, expect } from 'vitest';
import { compileMDX } from 'next-mdx-remote/rsc';
import { renderToStaticMarkup } from 'react-dom/server';
import { ARTICLE_MDX_OPTIONS } from './mdx-options';

const render = async (source: string) =>
  renderToStaticMarkup((await compileMDX({ source, options: ARTICLE_MDX_OPTIONS })).content);

describe('ARTICLE_MDX_OPTIONS (article + hero guide text blocks)', () => {
  it('turns a bare URL into a link', async () => {
    const out = await render('Grab the guide: https://metafy.gg/guides/view/maxx-nitro-bF6iXTpyCmO. Thanks!');
    expect(out).toContain('<a href="https://metafy.gg/guides/view/maxx-nitro-bF6iXTpyCmO"');
  });

  it('keeps ordinary markdown links and text as they were', async () => {
    const out = await render('See [the guide](https://example.com) and **bold**.');
    expect(out).toContain('<a href="https://example.com">the guide</a>');
    expect(out).toContain('<strong>bold</strong>');
  });
});

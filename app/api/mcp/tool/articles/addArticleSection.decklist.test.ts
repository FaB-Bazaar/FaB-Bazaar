import { describe, it, expect, vi, afterEach } from 'vitest';
import { addArticleSectionTool } from './addArticleSection';
import { updateArticleSectionTool } from './updateArticleSection';

const deck = {
  name: 'Midrange Maxx', hero: [], equipment: [], inventory: [],
  maindeck: [{ printingId: 'r1', quantity: 3, printingDetails: { name: 'Heist', pitch: 1, cost: 2, power: 5, defense: 3, types: [], keywords: [] } }],
};

function fakeFetch() {
  const calls: Array<{ url: string; method: string; body?: any }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    // the article PATCH answers with the saved article (the tools read article._id/title/slug)
    const payload = url.includes('/api/decks/') ? { success: true, data: deck }
      : { success: true, article: { _id: 'A1', title: 'Farewell to Dash', slug: 'farewell', sections: [] } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('MCP article tools freeze decklists', () => {
  const section = { type: 'decklist-block', deckId: 'D1', snapshotLabel: 'Week of Calling: Atlanta' };

  it('add_article_section: fetches the deck and saves a snapshot, not the label', async () => {
    const calls = fakeFetch();
    const res = await addArticleSectionTool.handler({ mode: 'confirm', articleId: 'A1', section }, undefined, 'mcp_token');
    expect(res.success).toBe(true);
    expect(calls[0].url).toMatch(/\/api\/decks\/D1$/);
    const patch = calls.find(c => c.method === 'PATCH')!;
    expect(patch.body.section.snapshot).toMatchObject({ label: 'Week of Calling: Atlanta', title: 'Midrange Maxx' });
    expect(patch.body.section).not.toHaveProperty('snapshotLabel');
  });

  it('update_article_section: same, for replacing a section', async () => {
    const calls = fakeFetch();
    const res = await updateArticleSectionTool.handler({ mode: 'confirm', articleId: 'A1', index: 2, section }, undefined, 'mcp_token');
    expect(res.success).toBe(true);
    const patch = calls.find(c => c.method === 'PATCH')!;
    expect(patch.body.section.snapshot.sections[0]).toMatchObject({ label: 'LIBRARY — RED', totalCards: 3 });
  });

  it('decklist-block is an accepted section type in both tools', () => {
    const types = (tool: any) => JSON.stringify(tool.parameters);
    expect(types(addArticleSectionTool)).toContain('decklist-block');
    expect(types(updateArticleSectionTool)).toContain('decklist-block');
  });
});

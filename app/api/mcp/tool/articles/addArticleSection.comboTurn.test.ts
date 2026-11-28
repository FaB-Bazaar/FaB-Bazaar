import { describe, it, expect, vi, afterEach } from 'vitest';
import { addArticleSectionTool } from './addArticleSection';
import { updateArticleSectionTool } from './updateArticleSection';
import huntsman from '@/lib/articles/__fixtures__/combo-turn-huntsman.json';

function fakeFetch() {
  const calls: Array<{ url: string; method: string; body?: any; auth?: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization });
    let payload: any;
    if (url.includes('/api/decks?')) payload = { success: true, decks: [{ name: 'Crankiest Maxx', publicId: 'DECK1' }] };
    else if (url.includes('/raw?shape=raw')) payload = { success: true, data: huntsman };
    else if (url.includes('/api/cards/by-talishar-id')) {
      const ids: string[] = JSON.parse(init.body).ids;
      payload = { success: true, data: Object.fromEntries(ids.map((id) => [id, { displayName: id, imageUrl: null, pitch: null, types: ['action', 'attack'] }])) };
    } else payload = { success: true, article: { _id: 'A1', title: '600+ games with Maxx', slug: 'maxx', sections: [] } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const section = { type: 'combo-turn', deckName: 'Crankiest Maxx', resultId: 'R1', turn: 8, captions: ['Throttle first.'] };

describe('MCP article tools freeze combo turns', () => {
  it('add_article_section preview lists the numbered steps and writes nothing', async () => {
    const calls = fakeFetch();
    const res: any = await addArticleSectionTool.handler({ articleId: 'A1', section }, undefined, 'mcp_token');
    expect(res.success).toBe(true);
    expect(res.sections[0].preview).toMatch(/8 steps/);
    expect(res.sections[0].preview).toMatch(/1\. throttle_red/);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('add_article_section confirm reads the game with the caller\'s bearer and saves the snapshot', async () => {
    const calls = fakeFetch();
    const res: any = await addArticleSectionTool.handler({ mode: 'confirm', articleId: 'A1', section }, undefined, 'mcp_token');
    expect(res.success).toBe(true);
    const raw = calls.find((c) => c.url.includes('/raw?shape=raw'))!;
    expect(raw.url).toMatch(/\/api\/decks\/DECK1\/results\/R1\/raw\?shape=raw$/);
    expect(raw.auth).toBe('Bearer mcp_token');
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body.section).toMatchObject({ type: 'combo-turn', captions: ['Throttle first.'], snapshot: { turn: 8, lethal: true } });
    expect(patch.body.section).not.toHaveProperty('resultId');
  });

  it('update_article_section: same, for replacing a section', async () => {
    const calls = fakeFetch();
    const res: any = await updateArticleSectionTool.handler({ mode: 'confirm', articleId: 'A1', index: 4, section }, undefined, 'mcp_token');
    expect(res.success).toBe(true);
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body.section.snapshot.steps).toHaveLength(8);
  });

  it('reports a bad turn instead of saving', async () => {
    const calls = fakeFetch();
    const res: any = await addArticleSectionTool.handler({ mode: 'confirm', articleId: 'A1', section: { ...section, turn: 42 } }, undefined, 'mcp_token');
    expect(res).toMatchObject({ success: false });
    expect(res.error).toMatch(/Turn 42/);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('combo-turn is an accepted section type in both tools', () => {
    for (const tool of [addArticleSectionTool, updateArticleSectionTool]) {
      expect(JSON.stringify(tool.parameters)).toContain('combo-turn');
      expect(tool.description).toContain('combo-turn');
    }
  });
});

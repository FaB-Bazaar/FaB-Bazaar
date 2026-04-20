import { describe, it, expect } from 'vitest';
import { shapeForMcpApp } from './getBinder';

describe('shapeForMcpApp', () => {
  it('returns a compact text summary for the model and full data in structuredContent', () => {
    const raw = {
      success: true,
      message: 'Binder retrieval completed',
      binder: { slug: 'mcp-binder', name: 'MCP Binder' },
      cards: [
        { name: 'Channel Lake Frigid', qty: 3, foil: 'RF', edition: '1st', collectorNumber: 'ELE146', condition: 'NM', forTrade: true, price: 12.5 },
        { name: 'Heart of Ice', qty: 1, foil: 'CF', edition: '1st', collectorNumber: 'ELE144', condition: 'NM', forTrade: false, price: 8 },
      ],
      pagination: { page: 1, limit: 100, total: 2 },
    };

    const out = shapeForMcpApp(raw);

    expect(out.content).toEqual([
      { type: 'text', text: expect.any(String) },
    ]);
    expect(out.content[0].text.length).toBeLessThanOrEqual(200);
    expect(out.content[0].text).toContain('MCP Binder');
    expect(out.content[0].text).toContain('2');

    expect(out.structuredContent.cards).toHaveLength(2);
    expect(out.structuredContent.cards[0].name).toBe('Channel Lake Frigid');
    expect(out.structuredContent.pagination).toEqual({ page: 1, limit: 100, total: 2 });
    expect(out.structuredContent.binder).toEqual({ slug: 'mcp-binder', name: 'MCP Binder' });
  });

  it('handles an empty binder without inflating context', () => {
    const raw = {
      success: true,
      binder: { slug: 'empty', name: 'Empty' },
      cards: [],
      pagination: { page: 1, limit: 100, total: 0 },
    };

    const out = shapeForMcpApp(raw);

    expect(out.content[0].text).toContain('0');
    expect(out.structuredContent.cards).toEqual([]);
  });

  it('passes errors through as text content with isError flag, no structuredContent payload', () => {
    const raw = { success: false, error: 'Binder not found' };

    const out = shapeForMcpApp(raw);

    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Binder not found');
    expect(out.structuredContent).toBeUndefined();
  });
});

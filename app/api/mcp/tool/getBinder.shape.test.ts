import { describe, it, expect } from 'vitest';
import { shapeForMcpApp } from './getBinder';

describe('shapeForMcpApp', () => {
  it('returns a full markdown table in content.text when showDetails is true (default) and always returns structuredContent', () => {
    const raw = {
      success: true,
      binder: { slug: 'mcp-binder', name: 'MCP Binder' },
      cards: [
        {
          display_name: 'Channel Lake Frigid',
          name: 'Channel Lake Frigid',
          quantity: 3, foiling: 'r', edition: 'f',
          collector_number: '146', set: 'ele',
          condition: 'NM', forTrade: true, tcg_low: 12.5,
        },
        {
          display_name: 'Heart of Ice',
          name: 'Heart of Ice',
          quantity: 1, foiling: 'c', edition: 'f',
          collector_number: '144', set: 'ele',
          condition: 'LP', forTrade: false, tcg_low: 8,
        },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    };

    const out = shapeForMcpApp(raw);

    const text = out.content[0].text;
    expect(out.content).toHaveLength(1);
    expect(text).toContain("Binder 'MCP Binder'");
    expect(text).toContain('2 of 2 cards');
    expect(text).toMatch(/\| Qty \| Foil \| Name \| Set \| Cond \| Trade \| Price \|/);
    expect(text).toContain('Channel Lake Frigid');
    expect(text).toContain('RF');
    expect(text).toContain('ELE146');
    expect(text).toContain('$12.50');
    expect(text).toContain('✅');
    expect(text).toContain('❌');
    expect(text).toContain('LP');

    expect(out.structuredContent?.cards).toHaveLength(2);
    expect(out.structuredContent?.binder).toEqual({ slug: 'mcp-binder', name: 'MCP Binder' });
    expect(out.structuredContent?.pagination).toMatchObject({ page: 1, total: 2 });
  });

  it('returns heading + URL (no table) when showDetails is false, but keeps full structuredContent', () => {
    const raw = {
      success: true,
      binder: { _id: '6807c60ac7ac9c20dfaff496', slug: 'mcp-binder', name: 'MCP Binder' },
      cards: [
        { display_name: 'Channel Lake Frigid', quantity: 3, foiling: 'r', set: 'ele', collector_number: '146', tcg_low: 12.5 },
      ],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    };

    const out = shapeForMcpApp(raw, { showDetails: false });

    expect(out.content[0].text).toContain("Binder 'MCP Binder' — 1 of 1 cards");
    expect(out.content[0].text).toContain('https://fabbazaar.app/binder/6807c60ac7ac9c20dfaff496');
    expect(out.content[0].text).not.toContain('|');
    expect(out.structuredContent?.cards).toHaveLength(1);
  });

  it('includes the binder URL in the detailed response too', () => {
    const raw = {
      success: true,
      binder: { _id: '6807c60ac7ac9c20dfaff496', name: 'MCP Binder' },
      cards: [{ display_name: 'Alpha', quantity: 1, set: 'arr', collector_number: '022' }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    };

    const out = shapeForMcpApp(raw);
    expect(out.content[0].text).toContain('https://fabbazaar.app/binder/6807c60ac7ac9c20dfaff496');
    expect(out.content[0].text).toContain('| Qty |');
  });

  it('omits the URL line gracefully when binder has no _id', () => {
    const raw = {
      success: true,
      binder: { slug: 'nope', name: 'Nope' },
      cards: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
    };

    const out = shapeForMcpApp(raw, { showDetails: false });
    expect(out.content[0].text).not.toContain('https://');
    expect(out.content[0].text).not.toContain('View:');
  });

  it('handles an empty binder without inflating context', () => {
    const raw = {
      success: true,
      binder: { slug: 'empty', name: 'Empty' },
      cards: [],
      pagination: { page: 1, limit: 100, total: 0 },
    };

    const out = shapeForMcpApp(raw);

    expect(out.content[0].text).toContain('0 of 0 cards');
    expect(out.content[0].text).not.toContain('| Qty |');
    expect(out.structuredContent?.cards).toEqual([]);
  });

  it('does not double-prefix set code when collector_number already starts with it', () => {
    const raw = {
      success: true,
      binder: { slug: 'b', name: 'B' },
      cards: [
        { display_name: 'Alpha Instinct', quantity: 3, collector_number: 'ARR022', set: 'arr' },
        { display_name: 'Bam Bam', quantity: 2, collector_number: '250', set: 'sea' },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    };

    const out = shapeForMcpApp(raw);

    expect(out.content[0].text).toContain('ARR022');
    expect(out.content[0].text).not.toContain('ARRARR022');
    expect(out.content[0].text).toContain('SEA250');
  });

  it('passes errors through as text content with isError flag, no structuredContent payload', () => {
    const raw = { success: false, error: 'Binder not found' };

    const out = shapeForMcpApp(raw);

    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Binder not found');
    expect(out.structuredContent).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { binderViewerResource } from './binderViewer';

async function mount(): Promise<JSDOM> {
  const html = await binderViewerResource.handler();
  return new JSDOM(html, { runScripts: 'dangerously' });
}

function dispatchToolResult(dom: JSDOM, structuredContent: Record<string, any>) {
  const win = dom.window as unknown as Window;
  win.dispatchEvent(
    new (dom.window as any).MessageEvent('message', {
      data: {
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: { structuredContent },
      },
    })
  );
}

describe('binder viewer iframe integration', () => {
  let dom: JSDOM;

  beforeEach(async () => {
    dom = await mount();
  });

  it('shows a loading placeholder before any tool result arrives', () => {
    const root = dom.window.document.getElementById('binder-app');
    expect(root?.textContent).toContain('Loading');
    expect(dom.window.document.querySelectorAll('.card.skeleton').length).toBeGreaterThan(0);
  });

  it('renders one card tile per card using real API field names', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'mcp-binder', name: 'MCP Binder' },
      cards: [
        {
          display_name: 'Channel Lake Frigid',
          name: 'Channel Lake Frigid',
          quantity: 3,
          foiling: 'r',
          edition: 'f',
          collector_number: '146',
          set: 'ele',
          condition: 'NM',
          forTrade: true,
          tcg_low: 12.5,
          printingId: 'abc-123',
        },
        {
          display_name: 'Heart of Ice',
          name: 'Heart of Ice',
          quantity: 1,
          foiling: 'c',
          edition: 'f',
          collector_number: '144',
          set: 'ele',
          condition: 'NM',
          forTrade: false,
          tcg_low: 8,
          image_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/xyz/public',
        },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    const tiles = dom.window.document.querySelectorAll('.card:not(.skeleton)');
    expect(tiles.length).toBe(2);

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('MCP Binder');
    expect(body).toContain('Channel Lake Frigid');
    expect(body).toContain('Heart of Ice');
    expect(body).toContain('$12.50');
    expect(body).toContain('RF');
    expect(body).toContain('CF');
    expect(body).toContain('1st');
    expect(body).toContain('ELE146');
    expect(body).toContain('3×');

    const tradeBadges = dom.window.document.querySelectorAll('.trade-badge');
    expect(tradeBadges.length).toBe(1);

    const arts = dom.window.document.querySelectorAll('.card-art');
    const styles = Array.from(arts).map((el) => (el as HTMLElement).getAttribute('style') || '');
    expect(styles.some((s) => s.includes('imagedelivery.net'))).toBe(true);
  });

  it('escapes HTML in card names (no XSS via structuredContent)', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'x', name: 'X' },
      cards: [{ name: '<script>alert(1)</script>', quantity: 1 }],
      pagination: { page: 1, limit: 1, total: 1 },
    });

    expect(dom.window.document.querySelectorAll('.card-name script').length).toBe(0);
    expect(dom.window.document.body.innerHTML).toContain('&lt;script&gt;');
  });

  it('ignores messages that are not jsonrpc 2.0 ui tool-result notifications', () => {
    const win = dom.window as any;
    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { jsonrpc: '1.0', method: 'ui/notifications/tool-result', params: { structuredContent: { cards: [{ name: 'x', quantity: 1 }] } } },
      })
    );
    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { jsonrpc: '2.0', method: 'ui/notifications/other', params: {} },
      })
    );

    expect(dom.window.document.querySelectorAll('.card:not(.skeleton)').length).toBe(0);
  });

  it('handles an empty cards array gracefully', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'empty', name: 'Empty' },
      cards: [],
      pagination: { page: 1, limit: 100, total: 0 },
    });

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('Empty');
    expect(body).toContain('No cards');
    expect(dom.window.document.querySelectorAll('.card:not(.skeleton)').length).toBe(0);
  });

  it('declares the Cloudflare Images CDN in _meta.ui.csp.resourceDomains', () => {
    expect(binderViewerResource._meta?.ui?.csp?.resourceDomains).toContain('https://imagedelivery.net');
  });
});

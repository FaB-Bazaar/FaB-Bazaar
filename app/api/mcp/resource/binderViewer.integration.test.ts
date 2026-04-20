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
  });

  it('renders one table row per card on ui/notifications/tool-result', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'mcp-binder', name: 'MCP Binder' },
      cards: [
        { name: 'Channel Lake Frigid', qty: 3, foil: 'RF', edition: '1st', collectorNumber: 'ELE146', condition: 'NM', forTrade: true, price: 12.5 },
        { name: 'Heart of Ice', qty: 1, foil: 'CF', edition: '1st', collectorNumber: 'ELE144', condition: 'NM', forTrade: false, price: 8 },
      ],
      pagination: { page: 1, limit: 100, total: 2 },
    });

    const rows = dom.window.document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('MCP Binder');
    expect(body).toContain('Channel Lake Frigid');
    expect(body).toContain('Heart of Ice');
    expect(body).toContain('$12.50');
    expect(body).toContain('✅');
    expect(body).toContain('❌');
  });

  it('escapes HTML in card names (no XSS via structuredContent)', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'x', name: 'X' },
      cards: [{ name: '<script>alert(1)</script>', qty: 1 }],
      pagination: { page: 1, limit: 1, total: 1 },
    });

    expect(dom.window.document.querySelectorAll('tbody script').length).toBe(0);
    expect(dom.window.document.body.innerHTML).toContain('&lt;script&gt;');
  });

  it('ignores messages that are not jsonrpc 2.0 ui tool-result notifications', () => {
    const win = dom.window as any;
    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { jsonrpc: '1.0', method: 'ui/notifications/tool-result', params: { structuredContent: { cards: [{ name: 'x', qty: 1 }] } } },
      })
    );
    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { jsonrpc: '2.0', method: 'ui/notifications/other', params: {} },
      })
    );

    expect(dom.window.document.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('handles an empty cards array gracefully', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'empty', name: 'Empty' },
      cards: [],
      pagination: { page: 1, limit: 100, total: 0 },
    });

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('Empty');
    expect(dom.window.document.querySelectorAll('tbody tr').length).toBe(0);
  });
});

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

  it('does not double-prefix collector_number when it already starts with the set code', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Alpha Instinct', quantity: 3, foiling: 'n', edition: 'n', collector_number: 'ARR022', set: 'arr', tcg_low: 2.89 },
        { name: 'Bam Bam', quantity: 2, foiling: 'n', edition: 'n', collector_number: '250', set: 'sea', tcg_low: 0.1 },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('ARR022');
    expect(body).not.toContain('ARRARR022');
    expect(body).toContain('SEA250');
  });

  it('filters cards by the search input', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Alpha Instinct', quantity: 1, set: 'arr', collector_number: '022' },
        { name: 'Bam Bam', quantity: 1, set: 'sea', collector_number: '250' },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    const input = dom.window.document.getElementById('search-input') as HTMLInputElement;
    input.value = 'bam';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Bam Bam']);
  });

  it('filters to for-trade only when the chip is toggled', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Alpha', quantity: 1, forTrade: true },
        { name: 'Beta', quantity: 1, forTrade: false },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    const trade = dom.window.document.querySelector('[data-filter="trade"]') as HTMLInputElement;
    trade.checked = true;
    trade.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Alpha']);
  });

  it('filters by rarity, foiling, and set via dropdowns', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Alpha', quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
        { name: 'Beta',  quantity: 1, rarity: 'c', foiling: 's', set: 'wtr' },
        { name: 'Gamma', quantity: 1, rarity: 'l', foiling: 's', set: 'wtr' },
      ],
      pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
    });

    const rarity = dom.window.document.getElementById('rarity-select') as HTMLSelectElement;
    rarity.value = 'l';
    rarity.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    let names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names.sort()).toEqual(['Alpha', 'Gamma']);

    const set = dom.window.document.getElementById('set-select') as HTMLSelectElement;
    set.value = 'wtr';
    set.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Gamma']);

    const clear = dom.window.document.getElementById('clear-btn') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names.length).toBe(3);
  });

  it('only lists rarity/foiling/set options that exist in the current cards', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Alpha', quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
        { name: 'Beta',  quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    const rarityOpts = Array.from(
      dom.window.document.querySelectorAll('#rarity-select option')
    ).map((o) => (o as HTMLOptionElement).value);
    expect(rarityOpts).toEqual(['', 'l']);

    const setOpts = Array.from(
      dom.window.document.querySelectorAll('#set-select option')
    ).map((o) => (o as HTMLOptionElement).value);
    expect(setOpts).toEqual(['', 'ele']);
  });

  it('sorts by price high→low', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [
        { name: 'Cheap', quantity: 1, tcg_low: 0.5 },
        { name: 'Pricey', quantity: 1, tcg_low: 99 },
        { name: 'Mid', quantity: 1, tcg_low: 10 },
      ],
      pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
    });

    const sort = dom.window.document.getElementById('sort-select') as HTMLSelectElement;
    sort.value = 'price-desc';
    sort.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Pricey', 'Mid', 'Cheap']);
  });

  it('opens a detail modal when a tile is clicked and closes it on backdrop click', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [{ name: 'Alpha', quantity: 1, image_url: 'https://imagedelivery.net/x/y/public' }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    const tile = dom.window.document.querySelector('.card[data-art]') as HTMLElement;
    tile.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    const backdrop = dom.window.document.getElementById('modal-backdrop');
    expect(backdrop).not.toBeNull();
    expect(dom.window.document.querySelector('.modal-art')).not.toBeNull();

    backdrop!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.document.getElementById('modal-backdrop')).toBeNull();
  });

  it('renders Prev/Next pager only when there is more than one page', () => {
    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [{ name: 'Alpha', quantity: 1 }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    expect(dom.window.document.getElementById('prev-btn')).toBeNull();

    dispatchToolResult(dom, {
      binder: { slug: 'b', name: 'B' },
      cards: [{ name: 'Alpha', quantity: 1 }],
      pagination: { page: 2, limit: 1, total: 5, totalPages: 5 },
    });
    expect(dom.window.document.getElementById('prev-btn')).not.toBeNull();
    expect(dom.window.document.getElementById('next-btn')).not.toBeNull();
    expect((dom.window.document.getElementById('prev-btn') as HTMLButtonElement).disabled).toBe(false);
  });
});

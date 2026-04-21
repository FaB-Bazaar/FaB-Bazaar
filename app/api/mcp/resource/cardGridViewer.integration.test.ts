import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { cardGridViewerResource } from './cardGridViewer';

async function mount(): Promise<JSDOM> {
  const html = await cardGridViewerResource.handler();
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

const BINDER_FILTERS = { trade: true, rarity: true, foiling: true, set: true };

describe('card-grid viewer iframe integration', () => {
  let dom: JSDOM;

  beforeEach(async () => {
    dom = await mount();
  });

  it('shows a loading placeholder before any tool result arrives', () => {
    const root = dom.window.document.getElementById('binder-app');
    expect(root?.textContent).toContain('Loading');
    expect(dom.window.document.querySelectorAll('.card.skeleton').length).toBeGreaterThan(0);
  });

  it('renders one card tile per card using real API field names (binder-style payload)', () => {
    dispatchToolResult(dom, {
      title: 'MCP Binder',
      url: 'https://fabbazaar.app/binder/abc',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 2, limit: 100 },
      cards: [
        {
          display_name: 'Channel Lake Frigid',
          name: 'Channel Lake Frigid',
          quantity: 3, foiling: 'r', edition: 'f',
          collector_number: '146', set: 'ele',
          condition: 'NM', forTrade: true, tcg_low: 12.5,
          printingId: 'abc-123',
        },
        {
          display_name: 'Heart of Ice',
          name: 'Heart of Ice',
          quantity: 1, foiling: 'c', edition: 'f',
          collector_number: '144', set: 'ele',
          condition: 'NM', forTrade: false, tcg_low: 8,
          image_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/xyz/public',
        },
      ],
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

  it('renders "Open on fabbazaar.app" link when url is provided', () => {
    dispatchToolResult(dom, {
      title: 'MCP Binder',
      url: 'https://fabbazaar.app/binder/abc',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 0 },
      cards: [],
    });
    const link = dom.window.document.querySelector('.subtitle a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://fabbazaar.app/binder/abc');
  });

  it('escapes HTML in card names (no XSS via structuredContent)', () => {
    dispatchToolResult(dom, {
      title: 'X',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 1 },
      cards: [{ name: '<script>alert(1)</script>', quantity: 1 }],
    });

    expect(dom.window.document.querySelectorAll('.card-name script').length).toBe(0);
    expect(dom.window.document.body.innerHTML).toContain('&lt;script&gt;');
  });

  it('ignores messages that are not jsonrpc 2.0 ui tool-result notifications', () => {
    const win = dom.window as any;
    win.dispatchEvent(
      new win.MessageEvent('message', {
        data: { jsonrpc: '1.0', method: 'ui/notifications/tool-result', params: { structuredContent: { title: 'X', cards: [{ name: 'x', quantity: 1 }] } } },
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
      title: 'Empty',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 0 },
      cards: [],
    });

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('Empty');
    expect(body).toContain('No cards');
    expect(dom.window.document.querySelectorAll('.card:not(.skeleton)').length).toBe(0);
  });

  it('declares the Cloudflare Images CDN in _meta.ui.csp.resourceDomains', () => {
    expect(cardGridViewerResource._meta?.ui?.csp?.resourceDomains).toContain('https://imagedelivery.net');
  });

  it('does not double-prefix collector_number when it already starts with the set code', () => {
    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 2 },
      cards: [
        { name: 'Alpha Instinct', quantity: 3, foiling: 'n', edition: 'n', collector_number: 'ARR022', set: 'arr', tcg_low: 2.89 },
        { name: 'Bam Bam', quantity: 2, foiling: 'n', edition: 'n', collector_number: '250', set: 'sea', tcg_low: 0.1 },
      ],
    });

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('ARR022');
    expect(body).not.toContain('ARRARR022');
    expect(body).toContain('SEA250');
  });

  it('filters cards by the search input', () => {
    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 2 },
      cards: [
        { name: 'Alpha Instinct', quantity: 1, set: 'arr', collector_number: '022' },
        { name: 'Bam Bam', quantity: 1, set: 'sea', collector_number: '250' },
      ],
    });

    const input = dom.window.document.getElementById('search-input') as HTMLInputElement;
    input.value = 'bam';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Bam Bam']);
  });

  it('filters to for-trade only when the chip is toggled (binder-style filters)', () => {
    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 2 },
      cards: [
        { name: 'Alpha', quantity: 1, forTrade: true },
        { name: 'Beta', quantity: 1, forTrade: false },
      ],
    });

    const trade = dom.window.document.querySelector('[data-filter="trade"]') as HTMLInputElement;
    trade.checked = true;
    trade.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Alpha']);
  });

  it('filters by rarity, foiling, and set via dropdowns (binder-style filters)', () => {
    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 3 },
      cards: [
        { name: 'Alpha', quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
        { name: 'Beta',  quantity: 1, rarity: 'c', foiling: 's', set: 'wtr' },
        { name: 'Gamma', quantity: 1, rarity: 'l', foiling: 's', set: 'wtr' },
      ],
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
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 2 },
      cards: [
        { name: 'Alpha', quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
        { name: 'Beta',  quantity: 1, rarity: 'l', foiling: 'r', set: 'ele' },
      ],
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
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 3 },
      cards: [
        { name: 'Cheap', quantity: 1, tcg_low: 0.5 },
        { name: 'Pricey', quantity: 1, tcg_low: 99 },
        { name: 'Mid', quantity: 1, tcg_low: 10 },
      ],
    });

    const sort = dom.window.document.getElementById('sort-select') as HTMLSelectElement;
    sort.value = 'price-desc';
    sort.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['Pricey', 'Mid', 'Cheap']);
  });

  it('opens a detail modal when a tile is clicked and closes it on backdrop click', () => {
    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 1 },
      cards: [{ name: 'Alpha', quantity: 1, image_url: 'https://imagedelivery.net/x/y/public' }],
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
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 1, totalPages: 1, total: 1, limit: 100 },
      cards: [{ name: 'Alpha', quantity: 1 }],
    });
    expect(dom.window.document.getElementById('prev-btn')).toBeNull();

    dispatchToolResult(dom, {
      title: 'B',
      filters: BINDER_FILTERS,
      pagination: { page: 2, totalPages: 5, total: 5, limit: 1 },
      cards: [{ name: 'Alpha', quantity: 1 }],
    });
    expect(dom.window.document.getElementById('prev-btn')).not.toBeNull();
    expect(dom.window.document.getElementById('next-btn')).not.toBeNull();
    expect((dom.window.document.getElementById('prev-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders priority chip + dropdown only when filters.priority is on (wants-style payload)', () => {
    dispatchToolResult(dom, {
      title: 'Wants · Main',
      subtitle: '5 unique · 12 total cards',
      url: 'https://fabbazaar.app/wants',
      filters: { priority: true, rarity: true, set: true },
      pagination: { page: 1, totalPages: 1, total: 2, limit: 100 },
      cards: [
        { name: 'High Priority Card', quantity: 1, priority: 'high', set: 'ele', rarity: 'm' },
        { name: 'Low Priority Card', quantity: 1, priority: 'low', set: 'ele', rarity: 'c' },
      ],
    });

    expect(dom.window.document.getElementById('priority-select')).not.toBeNull();
    // Binder-specific controls should be absent
    expect(dom.window.document.getElementById('foiling-select')).toBeNull();
    expect(dom.window.document.querySelector('[data-filter="trade"]')).toBeNull();

    const prio = dom.window.document.getElementById('priority-select') as HTMLSelectElement;
    prio.value = 'high';
    prio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const names = Array.from(dom.window.document.querySelectorAll('.card-name')).map((el) => el.textContent);
    expect(names).toEqual(['High Priority Card']);

    // Priority badge should appear on a priority-tagged card (no forTrade)
    expect(dom.window.document.querySelectorAll('.priority-badge').length).toBeGreaterThan(0);
  });

  it('works with no pagination and only rarity/set filters (curated-list-style payload)', () => {
    dispatchToolResult(dom, {
      title: 'Prism Staples',
      subtitle: 'Hero: Prism · CC · Published',
      filters: { rarity: true, set: true },
      cards: [
        { name: 'Channel Lake Frigid', set: 'ele', rarity: 'm', tcg_low: 10 },
        { name: 'Heart of Ice', set: 'ele', rarity: 'l', tcg_low: 8 },
      ],
    });

    expect(dom.window.document.getElementById('prev-btn')).toBeNull();
    expect(dom.window.document.getElementById('next-btn')).toBeNull();
    expect(dom.window.document.getElementById('foiling-select')).toBeNull();
    expect(dom.window.document.querySelector('[data-filter="trade"]')).toBeNull();
    expect(dom.window.document.getElementById('rarity-select')).not.toBeNull();
    expect(dom.window.document.getElementById('set-select')).not.toBeNull();

    const body = dom.window.document.body.textContent || '';
    expect(body).toContain('Prism Staples');
    expect(body).toContain('Hero: Prism · CC · Published');
  });
});

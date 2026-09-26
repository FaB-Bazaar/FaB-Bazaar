import { describe, it, expect } from 'vitest';
import { renderDeckOverlayHtml, renderNoDeckOverlayHtml, parseOverlayOptions } from './render-deck-overlay';
import type { DeckOverlayModel, OverlayCard } from './deck-overlay';

const c = (name: string, pitch: 1 | 2 | 3 | null, quantity = 1, imageUrl: string | null = `https://imagedelivery.net/x/${encodeURIComponent(name)}/public`): OverlayCard =>
  ({ name, pitch, quantity, imageUrl });

function model(overrides: Partial<DeckOverlayModel> = {}): DeckOverlayModel {
  const hero = c("Maxx 'The Hype' Nitro", null);
  const red = [c('Crankshaft', 1, 3)];
  const blue = [c('Zipper Hit', 3, 2)];
  return {
    name: 'Midrange Maxx',
    format: 'Classic Constructed',
    heroName: "Maxx 'The Hype' Nitro",
    hero,
    equipment: [c('Galvanic Bender', null)],
    pitchGroups: [
      { pitch: 1, label: 'Red', count: 3, cards: red },
      { pitch: 3, label: 'Blue', count: 2, cards: blue },
    ],
    maindeckCount: 5,
    inventoryGroups: [{ pitch: 1, label: 'Red', count: 2, cards: [c('Gas Up', 1, 2)] }],
    inventoryCount: 2,
    spotlight: [hero, ...red, ...blue],
    ...overrides,
  };
}

describe('parseOverlayOptions', () => {
  it('defaults to the spotlight layout with a 6 second interval, inventory shown', () => {
    expect(parseOverlayOptions(new URLSearchParams())).toEqual({ layout: 'spotlight', intervalSec: 6, showInventory: true });
  });

  it('accepts the list, pages and grid layouts', () => {
    expect(parseOverlayOptions(new URLSearchParams('layout=list')).layout).toBe('list');
    expect(parseOverlayOptions(new URLSearchParams('layout=pages')).layout).toBe('pages');
    expect(parseOverlayOptions(new URLSearchParams('layout=grid')).layout).toBe('grid');
  });

  it('hides the inventory with inventory=0', () => {
    expect(parseOverlayOptions(new URLSearchParams('inventory=0')).showInventory).toBe(false);
  });

  it('falls back to spotlight for an unknown layout', () => {
    expect(parseOverlayOptions(new URLSearchParams('layout=<svg>')).layout).toBe('spotlight');
  });

  it('clamps the interval between 3 and 60 seconds', () => {
    expect(parseOverlayOptions(new URLSearchParams('interval=1')).intervalSec).toBe(3);
    expect(parseOverlayOptions(new URLSearchParams('interval=999')).intervalSec).toBe(60);
    expect(parseOverlayOptions(new URLSearchParams('interval=abc')).intervalSec).toBe(6);
  });
});

describe('renderDeckOverlayHtml', () => {
  describe('grid layout', () => {
    const opts = { layout: 'grid' as const, intervalSec: 6 };
    const sections = (html: string) => [...html.matchAll(/<section[^>]*data-pitch="(\d)"/g)].map(m => m[1]);

    it('renders one section per maindeck pitch group with its label and count', () => {
      const html = renderDeckOverlayHtml(model(), opts);
      expect(sections(html)).toEqual(['1', '3']);
      expect(html).toMatch(/data-pitch="1"[\s\S]*Red[\s\S]*3/);
      expect(html).toMatch(/data-pitch="3"[\s\S]*Blue[\s\S]*2/);
    });

    it('shows each card as its image, named in alt text, with a count badge', () => {
      const html = renderDeckOverlayHtml(model(), opts);
      expect(html).toMatch(/<img[^>]*src="https:\/\/imagedelivery\.net\/x\/Crankshaft\/public"[^>]*alt="Crankshaft"/);
      expect(html).toMatch(/Crankshaft[\s\S]*×3/);
      expect(html).toMatch(/Zipper Hit[\s\S]*×2/);
    });

    it('puts the hero card in the header', () => {
      const html = renderDeckOverlayHtml(model(), opts);
      expect(html).toMatch(/class="hero-card"[^>]*src="https:\/\/imagedelivery\.net\/x\/Maxx/);
      expect(html).toContain('Midrange Maxx');
    });

    it('falls back to a name tile when a card has no usable art', () => {
      const html = renderDeckOverlayHtml(
        model({ pitchGroups: [{ pitch: 1, label: 'Red', count: 1, cards: [c('No Art', 1, 1, 'javascript:alert(1)')] }] }),
        opts
      );
      expect(html).not.toContain('javascript:alert');
      expect(html).toMatch(/class="tile noart"[\s\S]*No Art/);
    });

    it('leaves out equipment and the inventory', () => {
      const html = renderDeckOverlayHtml(model(), { ...opts, showInventory: true });
      expect(html).not.toContain('Galvanic Bender');
      expect(html).not.toContain('Gas Up');
    });

    it('escapes card names in text and attributes', () => {
      const evil = '"><script>alert(1)</script>';
      const html = renderDeckOverlayHtml(
        model({ name: evil, pitchGroups: [{ pitch: 1, label: 'Red', count: 1, cards: [c(evil, 1)] }] }),
        opts
      );
      expect(html).not.toContain('<script>alert(1)');
    });
  });

  it('renders a complete document with a transparent page background', () => {
    const html = renderDeckOverlayHtml(model(), { layout: 'list', intervalSec: 6 });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toMatch(/html,\s*body\s*\{[^}]*background:\s*transparent/);
  });

  it('shows the deck name, hero and FaB Bazaar branding', () => {
    const html = renderDeckOverlayHtml(model(), { layout: 'list', intervalSec: 6 });
    expect(html).toContain('Midrange Maxx');
    expect(html).toContain('Maxx &#39;The Hype&#39; Nitro');
    // visible text — the domain is styled in two spans
    expect(html.replace(/<[^>]+>/g, '')).toContain('fabbazaar.app');
  });

  it('lists maindeck cards with quantities under pitch headings in the list layout', () => {
    const html = renderDeckOverlayHtml(model(), { layout: 'list', intervalSec: 6 });
    expect(html).toMatch(/data-pitch="1"[\s\S]*Red[\s\S]*3[\s\S]*Crankshaft/);
    expect(html).toMatch(/data-pitch="3"[\s\S]*Blue[\s\S]*2[\s\S]*Zipper Hit/);
    expect(html).toContain('Galvanic Bender');
  });

  it('escapes user-controlled text in both layouts', () => {
    const evil = '<img src=x onerror=alert(1)>';
    for (const layout of ['list', 'spotlight'] as const) {
      const html = renderDeckOverlayHtml(
        model({ name: evil, pitchGroups: [{ pitch: 1, label: 'Red', count: 1, cards: [c(evil, 1)] }], spotlight: [c(evil, 1)] }),
        { layout, intervalSec: 6 }
      );
      expect(html).not.toContain('<img src=x');
    }
  });

  it('cannot break out of the embedded spotlight data with a closing script tag', () => {
    const html = renderDeckOverlayHtml(model({ spotlight: [c('</script><script>alert(1)</script>', 1)] }), { layout: 'spotlight', intervalSec: 6 });
    expect(html).not.toContain('</script><script>alert(1)');
  });

  it('drops card art that is not an https URL', () => {
    const html = renderDeckOverlayHtml(
      model({ spotlight: [c('Bad', 1, 1, 'javascript:alert(1)'), c('Plain', 1, 1, 'http://insecure.example/a.png')] }),
      { layout: 'spotlight', intervalSec: 6 }
    );
    expect(html).not.toContain('javascript:alert');
    expect(html).not.toContain('http://insecure.example');
  });

  it('embeds the spotlight cards and interval for the rotating layout', () => {
    const html = renderDeckOverlayHtml(model(), { layout: 'spotlight', intervalSec: 9 });
    expect(html).toContain('data-interval="9"');
    expect(html).toContain('https://imagedelivery.net/x/Crankshaft/public');
    expect(html).toContain('Zipper Hit');
  });

  describe('pages layout', () => {
    const opts = { layout: 'pages' as const, intervalSec: 7, showInventory: true };
    const pages = (html: string) => [...html.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]);

    it('renders one page per maindeck pitch group, then the inventory', () => {
      const html = renderDeckOverlayHtml(model(), opts);
      expect(pages(html)).toEqual(['Red', 'Blue', 'Inventory']);
      expect(html).toMatch(/data-page="Red"[\s\S]*3[\s\S]*Crankshaft/);
      expect(html).toMatch(/data-page="Inventory"[\s\S]*2[\s\S]*Gas Up/);
    });

    it('cycles the pages on the requested interval', () => {
      expect(renderDeckOverlayHtml(model(), opts)).toContain('data-interval="7"');
    });

    it('leaves the inventory page out when hidden or empty', () => {
      expect(pages(renderDeckOverlayHtml(model(), { ...opts, showInventory: false }))).toEqual(['Red', 'Blue']);
      expect(pages(renderDeckOverlayHtml(model({ inventoryGroups: [], inventoryCount: 0 }), opts))).toEqual(['Red', 'Blue']);
    });

    it('does not show equipment', () => {
      expect(renderDeckOverlayHtml(model(), opts)).not.toContain('Galvanic Bender');
    });

    it('escapes card names', () => {
      const html = renderDeckOverlayHtml(
        model({ pitchGroups: [{ pitch: 1, label: 'Red', count: 1, cards: [c('<b>x</b>', 1)] }] }),
        opts
      );
      expect(html).not.toContain('<b>x</b>');
    });
  });

  describe('live reload polling', () => {
    const poll = { url: '/overlay/u/m1stercakes/deck?check=1', version: 'deck123:2026-09-26T00:00:00.000Z' };

    it.each(['spotlight', 'list', 'pages'] as const)('embeds the poll URL and current version in the %s layout', layout => {
      const html = renderDeckOverlayHtml(model(), { layout, intervalSec: 6, poll });
      expect(html).toContain('data-poll-url="/overlay/u/m1stercakes/deck?check=1"');
      expect(html).toContain('data-version="deck123:2026-09-26T00:00:00.000Z"');
      expect(html).toContain('location.reload');
    });

    it('does not poll when no poll option is given', () => {
      const html = renderDeckOverlayHtml(model(), { layout: 'list', intervalSec: 6 });
      expect(html).not.toContain('data-poll-url');
      expect(html).not.toContain('location.reload');
    });

    it('escapes the poll URL and version', () => {
      const html = renderDeckOverlayHtml(model(), { layout: 'list', intervalSec: 6, poll: { url: '/x?"><script>', version: '"><b>' } });
      expect(html).not.toContain('"><script>');
      expect(html).not.toContain('"><b>');
    });
  });

  describe('renderNoDeckOverlayHtml', () => {
    it('renders a branded idle panel that keeps polling for a deck', () => {
      const html = renderNoDeckOverlayHtml({ url: '/overlay/u/m1stercakes/deck?check=1', version: '' });
      expect(html).toMatch(/html,\s*body\s*\{[^}]*background:\s*transparent/);
      expect(html.replace(/<[^>]+>/g, '')).toContain('fabbazaar.app');
      expect(html).toContain('data-poll-url="/overlay/u/m1stercakes/deck?check=1"');
      expect(html).toContain('location.reload');
    });
  });

  it('renders a friendly empty state when no card has art', () => {
    const html = renderDeckOverlayHtml(model({ spotlight: [] }), { layout: 'spotlight', intervalSec: 6 });
    expect(html).toContain('Midrange Maxx');
    expect(html).not.toContain('data-interval');
  });
});

import { describe, it, expect } from 'vitest';
import { renderDeckOverlayHtml, parseOverlayOptions } from './render-deck-overlay';
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
    spotlight: [hero, ...red, ...blue],
    ...overrides,
  };
}

describe('parseOverlayOptions', () => {
  it('defaults to the spotlight layout with a 6 second interval', () => {
    expect(parseOverlayOptions(new URLSearchParams())).toEqual({ layout: 'spotlight', intervalSec: 6 });
  });

  it('accepts the list layout', () => {
    expect(parseOverlayOptions(new URLSearchParams('layout=list')).layout).toBe('list');
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

  it('renders a friendly empty state when no card has art', () => {
    const html = renderDeckOverlayHtml(model({ spotlight: [] }), { layout: 'spotlight', intervalSec: 6 });
    expect(html).toContain('Midrange Maxx');
    expect(html).not.toContain('data-interval');
  });
});

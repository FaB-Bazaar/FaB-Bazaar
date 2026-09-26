import { describe, it, expect } from 'vitest';
import { buildStreamOverlayLinks } from './stream-overlay-links';

describe('buildStreamOverlayLinks', () => {
  const links = buildStreamOverlayLinks('https://fabbazaar.app', '/overlay/u/m1stercakes/deck');

  it('offers the paged list, spotlight and full list layouts on the profile overlay URL', () => {
    expect(links.map(l => l.url)).toEqual([
      'https://fabbazaar.app/overlay/u/m1stercakes/deck?layout=pages',
      'https://fabbazaar.app/overlay/u/m1stercakes/deck?layout=spotlight',
      'https://fabbazaar.app/overlay/u/m1stercakes/deck?layout=list',
    ]);
  });

  it('gives each link a label and a suggested OBS browser-source size', () => {
    for (const link of links) {
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.width).toBeGreaterThan(0);
      expect(link.height).toBeGreaterThan(0);
    }
  });

  it('tolerates a trailing slash on the origin', () => {
    expect(buildStreamOverlayLinks('http://localhost:3000/', '/overlay/u/a/deck')[0].url)
      .toBe('http://localhost:3000/overlay/u/a/deck?layout=pages');
  });
});

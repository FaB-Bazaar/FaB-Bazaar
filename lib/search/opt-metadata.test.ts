// /opt link previews: when the URL's `sets` param names exactly one real set,
// the page's <head> metadata should describe THAT set (title, description,
// set logo) so a Discord/Slack embed of the link says which set it is instead
// of the generic site card. Any other shape (no sets, several sets, a group
// token, an unknown code) keeps the inherited site metadata.
import { describe, it, expect } from 'vitest';
import { buildOptMetadata } from './opt-metadata';

describe('buildOptMetadata', () => {
  it('describes the set when exactly one known set code is selected', () => {
    const meta = buildOptMetadata({ sets: 'iar', sortBy: 'collector_number' });
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe('Usurp the Shadow Throne (IAR)');
    expect(meta!.description).toContain('Usurp the Shadow Throne');
    expect(meta!.openGraph?.title).toBe('Usurp the Shadow Throne (IAR)');
    expect(meta!.openGraph?.url).toBe('https://fabbazaar.app/opt?sets=iar');
  });

  it('uses the set logo as the preview image when one exists', () => {
    const meta = buildOptMetadata({ sets: 'iar' })!;
    const images = meta.openGraph?.images as Array<{ url: string; alt?: string }>;
    expect(images[0].url).toBe('https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/set-iar-logo/public');
    expect(images[0].alt).toContain('Usurp the Shadow Throne');
    // A wide banner reads better as a large card than a square thumbnail.
    expect((meta.twitter as { card?: string })?.card).toBe('summary_large_image');
  });

  it('falls back to the site icon (summary card) for a set without a logo', () => {
    const meta = buildOptMetadata({ sets: 'ira' })!;
    expect(meta.title).toBe('Welcome Deck: Ira (IRA)');
    const images = meta.openGraph?.images as Array<{ url: string }>;
    expect(images[0].url).toBe('https://fabbazaar.app/icon-512x512.png');
    expect((meta.twitter as { card?: string })?.card).toBe('summary');
  });

  it('normalises case and legacy aliases in the set code', () => {
    expect(buildOptMetadata({ sets: 'IAR' })?.title).toBe('Usurp the Shadow Throne (IAR)');
    expect(buildOptMetadata({ sets: 'hp1' })?.title).toBe('History Pack Vol.1 (1HP)');
  });

  it('returns null when no set is selected', () => {
    expect(buildOptMetadata({})).toBeNull();
    expect(buildOptMetadata({ sets: '' })).toBeNull();
    expect(buildOptMetadata({ q: 'command and conquer' })).toBeNull();
  });

  it('returns null for several sets, a group token, or an unknown code', () => {
    expect(buildOptMetadata({ sets: 'iar,mst' })).toBeNull();
    expect(buildOptMetadata({ sets: ['iar', 'mst'] })).toBeNull();
    expect(buildOptMetadata({ sets: 'grp:blitz' })).toBeNull();
    expect(buildOptMetadata({ sets: 'zzz' })).toBeNull();
  });
});

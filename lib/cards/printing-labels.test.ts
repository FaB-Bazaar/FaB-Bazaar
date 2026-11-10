/**
 * Labels for a printing's set / foiling / edition / rarity, from the compiled
 * constants (@/lib/fab-constants) — no request. The card search dialog used to
 * fetch /api/metadata on every mount for these, and its rarity lookup compared
 * each entry with itself (`r.code === r.code`), so every printing read as
 * "Common" once that request landed.
 */
import { describe, it, expect } from 'vitest';
import { editionLabel, foilingLabel, rarityLabel, setLabel } from './printing-labels';

describe('printing labels', () => {
  it('names a set from its code, either case', () => {
    expect(setLabel('wtr')).toBe('Welcome to Rathe');
    expect(setLabel('WTR')).toBe('Welcome to Rathe');
  });

  it('falls back to the upper-cased code for a set it does not know', () => {
    expect(setLabel('zzq')).toBe('ZZQ');
    expect(setLabel('')).toBe('Unknown Set');
  });

  it('names each rarity by its own code', () => {
    expect(rarityLabel('m')).toBe('Majestic');
    expect(rarityLabel('L')).toBe('Legendary');
    expect(rarityLabel('c')).toBe('Common');
    expect(rarityLabel('')).toBe('');
  });

  it('names foilings and editions', () => {
    expect(foilingLabel('r')).toBe('Rainbow Foil');
    expect(foilingLabel('c')).toBe('Cold Foil');
    expect(foilingLabel('')).toBe('Non-foil');
    expect(editionLabel('f')).toBe('First Edition');
    expect(editionLabel('u')).toBe('Unlimited');
    expect(editionLabel('')).toBe('');
  });

  it('passes an unknown code through', () => {
    expect(rarityLabel('qq')).toBe('qq');
    expect(foilingLabel('qq')).toBe('qq');
    expect(editionLabel('qq')).toBe('qq');
  });
});

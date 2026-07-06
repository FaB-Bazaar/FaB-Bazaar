import { describe, it, expect } from 'vitest';
import { matchesDeckFilter, type DeckFilterType } from './deck-filter';

// The /decks page filter dropdown. Since every Decks-to-Beat is now also a
// system deck (featured ⊆ system), the three buckets are a clean partition:
// personal | featured (all DTB) | system-but-not-featured.
const personal = { featured: false, isSystemDeck: false };
const dtb = { featured: true, isSystemDeck: true };   // Decks to Beat (also system)
const sysOnly = { featured: false, isSystemDeck: true }; // system, not featured
// Legacy drift shape that the data cleanup removed — kept to pin behavior.
const featuredNotSystem = { featured: true, isSystemDeck: false };

const run = (t: DeckFilterType, d: { featured?: boolean; isSystemDeck?: boolean }) => matchesDeckFilter(d, t);

describe('matchesDeckFilter — clean 3-way partition', () => {
  it('"all" (My Decks) = not featured and not system', () => {
    expect(run('all', personal)).toBe(true);
    expect(run('all', dtb)).toBe(false);
    expect(run('all', sysOnly)).toBe(false);
    expect(run('all', featuredNotSystem)).toBe(false);
  });

  it('"featured" = every featured deck (all Decks to Beat)', () => {
    expect(run('featured', dtb)).toBe(true);
    expect(run('featured', featuredNotSystem)).toBe(true);
    expect(run('featured', personal)).toBe(false);
    expect(run('featured', sysOnly)).toBe(false);
  });

  it('"system" (System only) = system but NOT featured', () => {
    expect(run('system', sysOnly)).toBe(true);
    expect(run('system', dtb)).toBe(false); // featured DTB live under "featured", not here
    expect(run('system', personal)).toBe(false);
  });

  it('partitions cleanly: a DTB deck lands in exactly one bucket', () => {
    const buckets = (['all', 'featured', 'system'] as DeckFilterType[]).filter((t) => run(t, dtb));
    expect(buckets).toEqual(['featured']);
  });
});

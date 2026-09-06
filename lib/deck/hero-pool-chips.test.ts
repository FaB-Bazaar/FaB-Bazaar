import { describe, it, expect } from 'vitest';
import { heroPoolChips } from './hero-pool-chips';

// The Add Card dialog's "Class" quick filter: one chip per affiliation the
// hero can play (its classes, its talents/essences) plus Generic — a way to
// slice the hero-legal pool without typing c:/tal: shorthand.
describe('heroPoolChips', () => {
  it('returns no chips without a hero', () => {
    expect(heroPoolChips(null)).toEqual([]);
  });

  it('single-class hero: class + generic (Dash)', () => {
    expect(heroPoolChips({ heroClasses: ['mechanologist'], heroTalents: [], heroEssences: [] })).toEqual([
      { kind: 'class', value: 'mechanologist', label: 'Mechanologist' },
      { kind: 'class', value: 'generic', label: 'Generic' },
    ]);
  });

  it('talented hero: class, talent, generic (Boltyn)', () => {
    expect(heroPoolChips({ heroClasses: ['warrior'], heroTalents: ['light'], heroEssences: [] })).toEqual([
      { kind: 'class', value: 'warrior', label: 'Warrior' },
      { kind: 'talent', value: 'light', label: 'Light' },
      { kind: 'class', value: 'generic', label: 'Generic' },
    ]);
  });

  it('essences become talent chips, deduped against real talents (Oldhim)', () => {
    const chips = heroPoolChips({ heroClasses: ['guardian'], heroTalents: ['elemental', 'ice'], heroEssences: ['ice', 'earth'] });
    expect(chips.map(c => c.value)).toEqual(['guardian', 'elemental', 'ice', 'earth', 'generic']);
  });

  it('drops essence elements that are not searchable talents (fire, water)', () => {
    const chips = heroPoolChips({ heroClasses: ['wizard'], heroTalents: [], heroEssences: ['fire', 'water', 'lightning'] });
    expect(chips.map(c => c.value)).toEqual(['wizard', 'lightning', 'generic']);
  });

  it('never duplicates generic when the hero data already lists it', () => {
    const chips = heroPoolChips({ heroClasses: ['generic', 'brute'], heroTalents: [], heroEssences: [] });
    expect(chips.filter(c => c.value === 'generic')).toHaveLength(1);
    expect(chips.map(c => c.value)).toEqual(['brute', 'generic']);
  });
});

import { describe, it, expect } from 'vitest';
import { parseSetInput, PRODUCT_KINDS } from './set-input';

const valid = {
  code: 'SPW', name: 'Smash Palace: Chorus of Steel', releaseDate: '2026-10-30',
  kind: 'booster', inCardFilters: true, hasFirstEdition: false, tcgGroups: [{ groupId: 24773, name: 'Smash Palace: Chorus of Steel' }],
};

describe('parseSetInput (register)', () => {
  it('normalizes a valid registration', () => {
    const r = parseSetInput(valid, 'register');
    expect(r).toEqual({
      ok: true,
      value: expect.objectContaining({
        code: 'spw', displayCode: 'SPW', name: 'Smash Palace: Chorus of Steel', releaseDate: '2026-10-30',
        legalFrom: null, category: 'standard', tier: 1, inCardFilters: true, hasFirstEdition: false,
        unlimitedBeforeFirst: false, tcgGroups: [{ groupId: 24773, name: 'Smash Palace: Chorus of Steel' }],
      }),
    });
  });

  it('maps each product kind to the category + tier the site sorts by', () => {
    expect(PRODUCT_KINDS.map((k) => [k.value, k.category, k.tier])).toEqual([
      ['booster', 'standard', 1],
      ['supplemental', 'standard', 2],
      ['deck', 'non-standard', 3],
      ['armory', 'armory', 4],
      ['promo', 'non-standard', 5],
      ['hidden', 'excluded', 5],
    ]);
  });

  it('allows an unannounced release date', () => {
    const r = parseSetInput({ ...valid, releaseDate: '' }, 'register');
    expect(r.ok && r.value.releaseDate).toBeNull();
  });

  it.each([
    [{ code: '' }, 'code'],
    [{ code: 'sp w' }, 'code'],
    [{ code: 'toolongcode1' }, 'code'],
    [{ name: '  ' }, 'name'],
    [{ releaseDate: '2026-13-01' }, 'releaseDate'],
    [{ releaseDate: '30/10/2026' }, 'releaseDate'],
    [{ legalFrom: 'soon' }, 'legalFrom'],
    [{ kind: 'mystery' }, 'kind'],
    [{ tcgGroups: [{ groupId: 'abc', name: 'x' }] }, 'tcgGroups'],
    [{ tcgGroups: [{ groupId: 1 }] }, 'tcgGroups'],
  ])('rejects %j (field %s)', (patch, field) => {
    const r = parseSetInput({ ...valid, ...patch }, 'register');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[field as string]).toBeTruthy();
  });

  it('dedupes repeated groups', () => {
    const r = parseSetInput({ ...valid, tcgGroups: [...valid.tcgGroups, ...valid.tcgGroups] }, 'register');
    expect(r.ok && r.value.tcgGroups).toHaveLength(1);
  });
});

describe('parseSetInput (update)', () => {
  it('ignores the code and keeps only the fields that were sent', () => {
    const r = parseSetInput({ code: 'nope', releaseDate: '2026-11-01' }, 'update');
    expect(r).toEqual({ ok: true, value: { releaseDate: '2026-11-01' } });
  });

  it('a kind sets both category and tier', () => {
    const r = parseSetInput({ kind: 'armory' }, 'update');
    expect(r).toEqual({ ok: true, value: { category: 'armory', tier: 4 } });
  });

  it('still validates what it keeps', () => {
    expect(parseSetInput({ name: '' }, 'update').ok).toBe(false);
  });
});

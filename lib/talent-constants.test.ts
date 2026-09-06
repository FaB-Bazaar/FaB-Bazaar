import { describe, it, expect } from 'vitest';
import { TalentUtils, OFFICIAL_TALENTS } from './talent-constants';

describe('TalentUtils.resolveTalent', () => {
  it('keeps canonical talents and the curated abbreviations', () => {
    for (const t of OFFICIAL_TALENTS) expect(TalentUtils.resolveTalent(t)).toBe(t);
    expect(TalentUtils.resolveTalent('i')).toBe('ice');
    expect(TalentUtils.resolveTalent('li')).toBe('lightning');
    expect(TalentUtils.resolveTalent('dragon')).toBe('draconic');
  });

  it('falls back to an unambiguous prefix', () => {
    expect(TalentUtils.resolveTalent('dra')).toBe('draconic');
    expect(TalentUtils.resolveTalent('elem')).toBe('elemental');
    expect(TalentUtils.resolveTalent('mys')).toBe('mystic');
    expect(TalentUtils.resolveTalent('lightn')).toBe('lightning');
    expect(TalentUtils.resolveTalent('reve')).toBe('revered');
    expect(TalentUtils.resolveTalent('revi')).toBe('reviled');
    expect(TalentUtils.resolveTalent('Sha')).toBe('shadow');
  });

  it('returns null when the prefix is ambiguous or unknown', () => {
    expect(TalentUtils.resolveTalent('rev')).toBeNull();   // revered | reviled
    expect(TalentUtils.resolveTalent('pirate')).toBeNull(); // a class, not a talent
    expect(TalentUtils.resolveTalent('')).toBeNull();
  });

  it('convertTalentsToFilters uses the prefix resolution', () => {
    expect(TalentUtils.convertTalentsToFilters(['dra'])).toEqual({ hasDraconic: true });
    expect(TalentUtils.convertTalentsToFilters(['reve'], true)).toEqual({ hasRevered: false });
  });
});

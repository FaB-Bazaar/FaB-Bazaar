import { describe, it, expect } from 'vitest';
import { resolveHeroShorthand, getHeroInfo, HERO_INFO, YOUNG_HERO_INFO } from './heroes';

// `hero:dor` should find Dorinthea the way `hero:dori` / `hero:dorinthea` do.
// The resolver returns a string getHeroInfo() resolves, or null when the input
// is ambiguous (ka → kano|kassai|katsu|kayo) or unknown.
const familyOf = (name: string) => {
  const info = getHeroInfo(name)!;
  const key = [...Object.entries(HERO_INFO), ...Object.entries(YOUNG_HERO_INFO)].find(([, v]) => v === info)![0];
  return key.replace(/^ser /, '').split(/[, ]/)[0];
};

describe('resolveHeroShorthand', () => {
  it('leaves already-resolvable names, nicknames and shortNames alone', () => {
    expect(resolveHeroShorthand('gravy')).toBe('gravy');
    expect(resolveHeroShorthand('dori')).toBe('dori');
    expect(resolveHeroShorthand('starvo')).toBe('starvo');
    expect(resolveHeroShorthand('dorinthea ironsong')).toBe('dorinthea ironsong');
  });

  it('resolves an unambiguous prefix of a hero given name', () => {
    expect(familyOf(resolveHeroShorthand('dor')!)).toBe('dorinthea');
    expect(familyOf(resolveHeroShorthand('brav')!)).toBe('bravo');
    expect(familyOf(resolveHeroShorthand('bolt')!)).toBe('boltyn');
    expect(familyOf(resolveHeroShorthand('Tek')!)).toBe('teklovossen');
    expect(familyOf(resolveHeroShorthand('iys')!)).toBe('iyslander');
  });

  it('resolves a prefix of a nickname or shortName to the same hero', () => {
    expect(familyOf(resolveHeroShorthand('grav')!)).toBe('gravy');
    expect(familyOf(resolveHeroShorthand('starv')!)).toBe('bravo');
  });

  it('returns null when the prefix spans several heroes', () => {
    expect(resolveHeroShorthand('ka')).toBeNull();
    expect(resolveHeroShorthand('v')).toBeNull();
  });

  it('returns null for unknown names', () => {
    expect(resolveHeroShorthand('xyzzy')).toBeNull();
    expect(resolveHeroShorthand('')).toBeNull();
  });
});

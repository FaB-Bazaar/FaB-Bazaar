import { describe, it, expect } from 'vitest';
import { buildDeckbuildingGuide, resolveGuideHero } from './deckbuilding-guide';

const ok = (r: ReturnType<typeof buildDeckbuildingGuide>) => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.text;
};

describe('buildDeckbuildingGuide', () => {
  it('always leads with the read-the-card-text discipline', () => {
    const text = ok(buildDeckbuildingGuide({ format: 'Classic Constructed' }));
    expect(text).toMatch(/never infer/i);
    expect(text).toMatch(/includeText/);
    expect(text.indexOf('Read the cards')).toBeLessThan(text.indexOf('construction rules'));
  });

  it.each([
    ['Classic Constructed', /at least 60/, /3 copies/],
    ['Living Legend', /at least 60/, /3 copies/],
    ['Blitz', /exactly 40/, /1 copy/],
    ['Silver Age', /exactly 40/, /2 copies/],
    ['Commoner', /exactly 40/, /2 copies/],
  ])('%s states its official deck size and copy limit', (format, size, copies) => {
    const text = ok(buildDeckbuildingGuide({ format }));
    expect(text).toMatch(size);
    expect(text).toMatch(copies);
  });

  it('says free-form formats have no fixed construction rules', () => {
    const text = ok(buildDeckbuildingGuide({ format: 'Casual' }));
    expect(text).toMatch(/no fixed construction rules/i);
  });

  it('rejects an unknown format', () => {
    const r = buildDeckbuildingGuide({ format: 'Standard' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Classic Constructed/);
  });

  it('rejects an unknown hero', () => {
    const r = buildDeckbuildingGuide({ format: 'Blitz', heroName: 'notahero' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/notahero/);
  });

  it('includes the hero roster facts and the card text/life it was given', () => {
    const text = ok(buildDeckbuildingGuide({
      format: 'Classic Constructed',
      heroName: 'dorinthea ironsong',
      heroCard: { text: 'Once per Turn Effect — test hero text', health: 40 },
    }));
    expect(text).toMatch(/warrior/i);
    expect(text).toMatch(/test hero text/);
    expect(text).toMatch(/life 40/i);
  });

  it('tells the agent to read the hero card itself when the card was not fetched', () => {
    const text = ok(buildDeckbuildingGuide({ format: 'Blitz', heroName: 'dorinthea' }));
    expect(text).toMatch(/search_printings/);
  });

  it('flags a hero of the wrong age for the format', () => {
    const text = ok(buildDeckbuildingGuide({ format: 'Blitz', heroName: 'dorinthea ironsong' }));
    expect(text).toMatch(/not legal in blitz/i);
    expect(text).toMatch(/young hero/i);
  });

  it('explains the class/talent subset rule and the slash hybrid', () => {
    const text = ok(buildDeckbuildingGuide({ format: 'Classic Constructed', heroName: 'dorinthea ironsong' }));
    expect(text).toMatch(/subset/i);
    expect(text).toMatch(/\//);
  });
});

describe('resolveGuideHero', () => {
  it('resolves adult, young and nickname forms', () => {
    expect(resolveGuideHero('dorinthea ironsong')?.age).toBe('adult');
    expect(resolveGuideHero('dorinthea')?.age).toBe('young');
    expect(resolveGuideHero('Dorinthea Ironsong')?.canonical).toBe('dorinthea ironsong');
  });

  it('returns null for an unknown name', () => {
    expect(resolveGuideHero('notahero')).toBeNull();
  });
});

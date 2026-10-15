import { describe, it, expect } from 'vitest';
import { resolveTalisharHeroId, parseEventType, deckFormatToCode, parseManualGame } from './manual-game';

describe('resolveTalisharHeroId', () => {
  it('maps full names, nicknames, Talishar ids and accented spellings to the stored Talishar id', () => {
    expect(resolveTalisharHeroId('Malice, Domina of the Dead')).toBe('malice_domina_of_the_dead');
    expect(resolveTalisharHeroId('malice_domina_of_the_dead')).toBe('malice_domina_of_the_dead');
    expect(resolveTalisharHeroId('Jarl Vetreiði')).toBe('jarl_vetreidi');
    expect(resolveTalisharHeroId('jarl vetreidi')).toBe('jarl_vetreidi');
    expect(resolveTalisharHeroId('dori')).toBe('dorinthea_ironsong');
    expect(resolveTalisharHeroId('  Teklovossen, Esteemed Magnate ')).toBe('teklovossen_esteemed_magnate');
  });

  it('returns null for unknown heroes', () => {
    expect(resolveTalisharHeroId('Not A Hero')).toBeNull();
    expect(resolveTalisharHeroId('')).toBeNull();
  });
});

describe('parseEventType', () => {
  it('maps event-type labels and short codes to Talishar format codes', () => {
    expect(parseEventType('Classic Constructed')).toBe('0');
    expect(parseEventType('Classic Constructed Competitive')).toBe('1');
    expect(parseEventType('cc')).toBe('0');
    expect(parseEventType('compcc')).toBe('1');
    expect(parseEventType('Blitz')).toBe('2');
    expect(parseEventType('Silver Age')).toBe('14');
    expect(parseEventType('Silver Age Competitive')).toBe('15');
    expect(parseEventType('1')).toBe('1');
  });

  it('returns null for unknown event types', () => {
    expect(parseEventType('Sealed Super League')).toBeNull();
    expect(parseEventType('99')).toBeNull();
  });
});

describe('deckFormatToCode', () => {
  it('derives the casual format code from the deck format', () => {
    expect(deckFormatToCode('Classic Constructed')).toBe('0');
    expect(deckFormatToCode('Silver Age')).toBe('14');
    expect(deckFormatToCode('Blitz')).toBe('2');
    expect(deckFormatToCode(undefined)).toBeNull();
  });
});

describe('parseManualGame', () => {
  const ctx = { defaultFormat: '0' };

  it('parses a Fabrary-style row (no turn-by-turn data needed)', () => {
    const r = parseManualGame({
      opponentHero: 'Malice, Domina of the Dead', playedAt: '2026-10-14T20:49:00-04:00',
      eventType: 'Classic Constructed Competitive', turnOrder: 'First', totalTurns: 7, result: 'Won',
    }, ctx);
    expect(r).toEqual({ ok: true, value: {
      opponentHero: 'malice_domina_of_the_dead', playedAt: new Date('2026-10-15T00:49:00Z'),
      format: '1', firstPlayer: true, totalTurns: 7, result: 'win',
    } });
  });

  it('only opponent, result and date are required; format falls back to the deck format', () => {
    const r = parseManualGame({ opponentHero: 'dori', result: 'loss', playedAt: '2026-10-12T22:50:00-04:00' }, ctx);
    expect(r).toEqual({ ok: true, value: {
      opponentHero: 'dorinthea_ironsong', playedAt: new Date('2026-10-13T02:50:00Z'),
      format: '0', firstPlayer: null, totalTurns: null, result: 'loss',
    } });
  });

  it('rejects unknown heroes, bad results, bad dates and silly turn counts with a reason', () => {
    const base = { opponentHero: 'dori', result: 'win', playedAt: '2026-10-12T22:50:00-04:00' };
    expect(parseManualGame({ ...base, opponentHero: 'Nobody' }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/Nobody/) });
    expect(parseManualGame({ ...base, result: 'draw' }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/result/) });
    expect(parseManualGame({ ...base, playedAt: 'last tuesday' }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/playedAt/) });
    expect(parseManualGame({ ...base, playedAt: '2099-01-01T00:00:00Z' }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/future/) });
    expect(parseManualGame({ ...base, totalTurns: -1 }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/totalTurns/) });
    expect(parseManualGame({ ...base, eventType: 'Sealed Super League' }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/eventType/) });
  });
});

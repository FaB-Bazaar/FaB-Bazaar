/**
 * Unit tests for deck card validation predicates.
 *
 * Pure functions — no DB required. Each predicate returns
 * { ok: true } or { ok: false, reason: string } with a human-readable reason
 * suitable for surfacing back to the MCP client per-card.
 */

import { describe, it, expect } from 'vitest';
import { validateCardForHero, validateCopyLimit, validateFormatLegal, validateNotSuspended, validateNotBanned } from './validation';

const kanoYoung = { classes: ['wizard'], talents: [], essences: [] };
const briarYoung = { classes: ['runeblade'], talents: ['elemental'], essences: ['earth', 'lightning'] };
const dorintheaYoung = { classes: ['warrior'], talents: [], essences: [] };
const boltynYoung = { classes: ['warrior'], talents: ['light'], essences: [] };

const wizardCard = { classes: ['wizard'], talents: [] };
const genericCard = { classes: ['generic'], talents: [] };
const lightningCard = { classes: ['generic'], talents: ['lightning'] };
const iceCard = { classes: ['generic'], talents: ['ice'] };
const lightRoyalCard = { classes: ['warrior'], talents: ['light', 'royal'] };
const noClassNoTalent = { classes: [], talents: [] };

describe('validateCardForHero', () => {
  it('accepts a wizard card for Kano', () => {
    expect(validateCardForHero(wizardCard, kanoYoung)).toEqual({ ok: true });
  });

  it('accepts a generic card for Dorinthea', () => {
    expect(validateCardForHero(genericCard, dorintheaYoung)).toEqual({ ok: true });
  });

  it('rejects an ice card for Kano (no ice essence)', () => {
    const result = validateCardForHero(iceCard, kanoYoung);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/ice/i);
  });

  it('rejects a lightning card for Kano (no lightning essence)', () => {
    const result = validateCardForHero(lightningCard, kanoYoung);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/lightning/i);
  });

  it('accepts a lightning card for Briar (has lightning essence)', () => {
    expect(validateCardForHero(lightningCard, briarYoung)).toEqual({ ok: true });
  });

  it('rejects an ice card for Briar (only earth + lightning)', () => {
    const result = validateCardForHero(iceCard, briarYoung);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/ice/i);
  });

  it('rejects a wizard card for Dorinthea', () => {
    const result = validateCardForHero(wizardCard, dorintheaYoung);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/wizard/i);
  });

  it('accepts a light+royal warrior card for Boltyn (warrior+light) — wait, royal is a talent Boltyn does NOT have — should reject', () => {
    const result = validateCardForHero(lightRoyalCard, boltynYoung);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/royal/i);
  });

  it('accepts a card with empty classes and empty talents (e.g. heroes themselves)', () => {
    expect(validateCardForHero(noClassNoTalent, kanoYoung)).toEqual({ ok: true });
  });

  it('treats null classes/talents the same as empty', () => {
    const card = { classes: null, talents: null } as any;
    expect(validateCardForHero(card, kanoYoung)).toEqual({ ok: true });
  });
});

describe('validateCopyLimit', () => {
  it('Silver Age: 2 copies ok', () => {
    expect(validateCopyLimit(2, 'Silver Age', {})).toEqual({ ok: true });
  });

  it('Silver Age: 3 copies rejected', () => {
    const result = validateCopyLimit(3, 'Silver Age', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/2/);
    expect(result.reason).toMatch(/silver age/i);
  });

  it('Blitz: 3 copies rejected', () => {
    const result = validateCopyLimit(3, 'Blitz', {});
    expect(result.ok).toBe(false);
  });

  it('Classic Constructed: 3 copies ok', () => {
    expect(validateCopyLimit(3, 'Classic Constructed', {})).toEqual({ ok: true });
  });

  it('Classic Constructed: 4 copies rejected', () => {
    const result = validateCopyLimit(4, 'Classic Constructed', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/3/);
  });

  it('Living Legend: legendary keyword limited to 1', () => {
    const result = validateCopyLimit(2, 'Living Legend', { keywords: ['legendary'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/legendary/i);
  });

  it('Living Legend: ll-restricted limited to 1', () => {
    const result = validateCopyLimit(2, 'Living Legend', { llRestricted: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/restricted/i);
  });

  it('Any format: unlimited keyword is exempt from copy limit', () => {
    expect(validateCopyLimit(99, 'Silver Age', { keywords: ['unlimited'] })).toEqual({ ok: true });
    expect(validateCopyLimit(99, 'Classic Constructed', { keywords: ['unlimited'] })).toEqual({ ok: true });
  });

  it('Casual / Limited / UPF formats apply no copy limit', () => {
    expect(validateCopyLimit(99, 'Casual', {})).toEqual({ ok: true });
    expect(validateCopyLimit(99, 'Limited', {})).toEqual({ ok: true });
    expect(validateCopyLimit(99, 'Ultimate Pit Fight', {})).toEqual({ ok: true });
  });

  it('keyword check is case-insensitive', () => {
    expect(validateCopyLimit(99, 'Silver Age', { keywords: ['Unlimited'] })).toEqual({ ok: true });
    expect(validateCopyLimit(99, 'Silver Age', { keywords: ['UNLIMITED'] })).toEqual({ ok: true });
  });
});

describe('validateFormatLegal', () => {
  it('Silver Age accepts a card whose silverAgeLegal=true', () => {
    expect(validateFormatLegal({ silverAgeLegal: true }, 'Silver Age')).toEqual({ ok: true });
  });

  it('Silver Age rejects a card whose silverAgeLegal=false (e.g. LL-only)', () => {
    const result = validateFormatLegal({ silverAgeLegal: false, llLegal: true }, 'Silver Age');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/silver age/i);
    expect(result.reason).toMatch(/not legal/i);
  });

  it('Classic Constructed rejects a card whose ccLegal=false', () => {
    const result = validateFormatLegal({ ccLegal: false }, 'Classic Constructed');
    expect(result.ok).toBe(false);
  });

  it('Classic Constructed accepts a card whose ccLegal=true', () => {
    expect(validateFormatLegal({ ccLegal: true }, 'Classic Constructed')).toEqual({ ok: true });
  });

  it('Living Legend uses llLegal', () => {
    expect(validateFormatLegal({ llLegal: false }, 'Living Legend').ok).toBe(false);
    expect(validateFormatLegal({ llLegal: true }, 'Living Legend')).toEqual({ ok: true });
  });

  it('free-form formats (Casual / Limited / UPF) skip the check', () => {
    expect(validateFormatLegal({}, 'Casual')).toEqual({ ok: true });
    expect(validateFormatLegal({}, 'Limited')).toEqual({ ok: true });
    expect(validateFormatLegal({}, 'Ultimate Pit Fight')).toEqual({ ok: true });
  });

  it('treats missing flag as unknown — skip rather than reject', () => {
    expect(validateFormatLegal({}, 'Silver Age')).toEqual({ ok: true });
  });
});

describe('validateNotSuspended', () => {
  it('Classic Constructed accepts a non-suspended card', () => {
    expect(validateNotSuspended({ ccSuspended: false }, 'Classic Constructed')).toEqual({ ok: true });
  });

  it('Classic Constructed rejects a suspended card', () => {
    const result = validateNotSuspended({ ccSuspended: true }, 'Classic Constructed');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/suspend/i);
  });

  it('Silver Age uses silverAgeSuspended', () => {
    expect(validateNotSuspended({ silverAgeSuspended: true }, 'Silver Age').ok).toBe(false);
    expect(validateNotSuspended({ silverAgeSuspended: false }, 'Silver Age')).toEqual({ ok: true });
  });

  it('Living Legend has no suspended concept (always ok)', () => {
    expect(validateNotSuspended({}, 'Living Legend')).toEqual({ ok: true });
  });
});

describe('validateNotBanned', () => {
  it('accepts when card is not in banned set', () => {
    const banned = new Set<string>(['cardA', 'cardB']);
    expect(validateNotBanned('cardC', banned)).toEqual({ ok: true });
  });

  it('rejects when card is in banned set', () => {
    const banned = new Set<string>(['cardA']);
    const result = validateNotBanned('cardA', banned);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/banned/i);
  });

  it('accepts when cardUniqueId is null/undefined', () => {
    expect(validateNotBanned(null, new Set<string>(['x']))).toEqual({ ok: true });
    expect(validateNotBanned(undefined, new Set<string>(['x']))).toEqual({ ok: true });
  });
});

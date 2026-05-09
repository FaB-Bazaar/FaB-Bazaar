/**
 * Unit tests for deck card validation predicates.
 *
 * Pure functions — no DB required. Each predicate returns
 * { ok: true } or { ok: false, reason: string } with a human-readable reason
 * suitable for surfacing back to the MCP client per-card.
 */

import { describe, it, expect } from 'vitest';
import { validateCardForHero } from './validation';

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

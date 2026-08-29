/**
 * Unit tests for canonicalHeroId — read-time normalisation of Talishar hero ids
 * that name a TRANSFORMED form (a demi-hero) back to the hero the player
 * started as. The DB keeps whatever Talishar sent; every read path maps.
 *
 * Adult vs young is decided by the Talishar numeric format code (Talishar
 * Libraries/PlayerSettings.php FormatCode()): 0 cc, 1 compcc, 2 blitz,
 * 4 futurecc, 5 commoner, 8/13 LL cc, 14/15/16 silver age, 17 open.
 */

import { describe, it, expect } from 'vitest';
import { canonicalHeroId, isYoungTalisharFormat } from './canonicalHero';

describe('canonicalHeroId', () => {
  it('maps every Arakni demi-hero to Marionette in adult formats', () => {
    for (const demi of ['arakni_redback', 'arakni_black_widow', 'arakni_orb_weaver', 'arakni_tarantula', 'arakni_funnel_web', 'arakni_trap_door']) {
      expect(canonicalHeroId(demi, '0')).toBe('arakni_marionette');   // cc
      expect(canonicalHeroId(demi, '1')).toBe('arakni_marionette');   // compcc
      expect(canonicalHeroId(demi, '17')).toBe('arakni_marionette');  // open
    }
  });

  it('maps Arakni demi-heroes to Web of Deceit in young formats', () => {
    expect(canonicalHeroId('arakni_redback', '2')).toBe('arakni_web_of_deceit');   // blitz
    expect(canonicalHeroId('arakni_redback', '14')).toBe('arakni_web_of_deceit');  // silver age
    expect(canonicalHeroId('arakni_redback', '5')).toBe('arakni_web_of_deceit');   // commoner
  });

  it('maps Teklovossen and Levia transformed forms by format', () => {
    expect(canonicalHeroId('teklovossen_the_mechropotent', '0')).toBe('teklovossen_esteemed_magnate');
    expect(canonicalHeroId('teklovossen_the_mechropotent', '15')).toBe('teklovossen');
    expect(canonicalHeroId('blasmophet_levia_consumed', '1')).toBe('levia_shadowborn_abomination');
    expect(canonicalHeroId('levia_redeemed', '0')).toBe('levia_shadowborn_abomination');
    expect(canonicalHeroId('blasmophet_levia_consumed', '2')).toBe('levia');
  });

  it('defaults to the adult form when the format is unknown or missing', () => {
    expect(canonicalHeroId('arakni_redback')).toBe('arakni_marionette');
    expect(canonicalHeroId('arakni_redback', null)).toBe('arakni_marionette');
    expect(canonicalHeroId('teklovossen_the_mechropotent', 'weird')).toBe('teklovossen_esteemed_magnate');
  });

  it('passes real heroes and empty values through untouched', () => {
    expect(canonicalHeroId('arakni_marionette', '0')).toBe('arakni_marionette');
    expect(canonicalHeroId('teklovossen_esteemed_magnate', '2')).toBe('teklovossen_esteemed_magnate');
    expect(canonicalHeroId('dash_io', '0')).toBe('dash_io');
    expect(canonicalHeroId(null, '0')).toBeNull();
    expect(canonicalHeroId(undefined, '0')).toBeUndefined();
    expect(canonicalHeroId('', '0')).toBe('');
  });
});

describe('isYoungTalisharFormat', () => {
  it('classifies the Talishar codes seen in production', () => {
    expect(isYoungTalisharFormat('0')).toBe(false);
    expect(isYoungTalisharFormat('1')).toBe(false);
    expect(isYoungTalisharFormat('4')).toBe(false);
    expect(isYoungTalisharFormat('17')).toBe(false);
    expect(isYoungTalisharFormat('14')).toBe(true);
    expect(isYoungTalisharFormat('15')).toBe(true);
    expect(isYoungTalisharFormat('16')).toBe(true);
    expect(isYoungTalisharFormat(2)).toBe(true);
    expect(isYoungTalisharFormat(undefined)).toBe(false);
  });
});

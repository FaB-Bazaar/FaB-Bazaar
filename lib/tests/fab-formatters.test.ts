// lib/tests/fab-formatters.test.ts

import { describe, it, expect } from 'vitest';
import { getSetName, getFoilingName, getEditionName, getRarityName } from '../fab-formatters';

describe('FAB Formatters', () => {

  describe('getSetName', () => {
    it('should return the full set name for a valid lowercase code', () => {
      expect(getSetName('wtr')).toBe('Welcome to Rathe');
    });

    it('should return the full set name for a valid uppercase code', () => {
      expect(getSetName('EVO')).toBe('Bright Lights');
    });

    it('should return the original code if the set is not found in the map', () => {
      expect(getSetName('xyz')).toBe('xyz');
    });

    it('should handle null, undefined, and empty string inputs gracefully', () => {
      expect(getSetName(null)).toBe('');
      expect(getSetName(undefined)).toBe('');
      expect(getSetName('')).toBe('');
    });
  });

  describe('getFoilingName', () => {
    it('should return the full foiling name from a code', () => {
      expect(getFoilingName('c')).toBe('Cold Foil');
      expect(getFoilingName('r')).toBe('Rainbow Foil');
      expect(getFoilingName('s')).toBe('Non-foil');
      expect(getFoilingName('g')).toBe('Gold Foil');
    });
    
    it('should handle a full-word key', () => {
      expect(getFoilingName('cold foil')).toBe('Cold Foil');
    });

    it('should return the original code if not found', () => {
      expect(getFoilingName('x')).toBe('x');
    });
  });

  describe('getEditionName', () => {
    it('should return the full edition name from a code', () => {
      expect(getEditionName('f')).toBe('First Edition');
      expect(getEditionName('u')).toBe('Unlimited');
      expect(getEditionName('a')).toBe('Alpha');
      expect(getEditionName('n')).toBe('Normal');
    });

    it('should return the original code if not found', () => {
      expect(getEditionName('z')).toBe('z');
    });
  });
  
  describe('getRarityName', () => {
    it('should return the full rarity name from a code', () => {
      expect(getRarityName('c')).toBe('Common');
      expect(getRarityName('r')).toBe('Rare');
      expect(getRarityName('s')).toBe('Super Rare');
      expect(getRarityName('m')).toBe('Majestic');
      expect(getRarityName('l')).toBe('Legendary');
      expect(getRarityName('f')).toBe('Fabled');
      expect(getRarityName('t')).toBe('Token');
      expect(getRarityName('v')).toBe('Marvel');
      expect(getRarityName('p')).toBe('Promo');
    });

    it('should return the original code if not found', () => {
      expect(getRarityName('y')).toBe('y');
    });
  });
});
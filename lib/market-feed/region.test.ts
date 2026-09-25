import { describe, it, expect } from 'vitest';
import { countryToFeedRegion, resolveFeedRegion, isFeedRegion } from './region';

describe('countryToFeedRegion', () => {
  it('maps the Americas to North America', () => {
    for (const cc of ['US', 'CA', 'MX', 'BR', 'AR']) expect(countryToFeedRegion(cc)).toBe('na');
  });

  it('maps Europe (and the Middle East / Africa) to Europe', () => {
    for (const cc of ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'PL', 'EE', 'IE', 'IL', 'ZA']) {
      expect(countryToFeedRegion(cc)).toBe('eu');
    }
  });

  it('maps Asia and Oceania to APAC', () => {
    for (const cc of ['JP', 'KR', 'CN', 'SG', 'MY', 'PH', 'AU', 'NZ', 'IN']) expect(countryToFeedRegion(cc)).toBe('apac');
  });

  it('is case-insensitive and returns null for unknown or missing codes', () => {
    expect(countryToFeedRegion('gb')).toBe('eu');
    expect(countryToFeedRegion('XX')).toBeNull();
    expect(countryToFeedRegion('T1')).toBeNull(); // Cloudflare's Tor code
    expect(countryToFeedRegion(null)).toBeNull();
    expect(countryToFeedRegion('')).toBeNull();
  });
});

describe('resolveFeedRegion', () => {
  it('prefers an explicit choice, then the remembered one', () => {
    expect(resolveFeedRegion({ requested: 'apac', remembered: 'eu', profileCountry: 'US', ipCountry: 'US' })).toBe('apac');
    expect(resolveFeedRegion({ remembered: 'eu', profileCountry: 'US', ipCountry: 'US' })).toBe('eu');
  });

  it('then the profile country, then the connection country', () => {
    expect(resolveFeedRegion({ profileCountry: 'GB', ipCountry: 'US' })).toBe('eu');
    expect(resolveFeedRegion({ ipCountry: 'AU' })).toBe('apac');
  });

  it('ignores invalid values and falls back to North America', () => {
    expect(resolveFeedRegion({ requested: 'mars', remembered: 'nope', profileCountry: 'XX', ipCountry: 'T1' })).toBe('na');
    expect(resolveFeedRegion({})).toBe('na');
  });
});

describe('isFeedRegion', () => {
  it('accepts only the three regions', () => {
    expect(['na', 'eu', 'apac'].every(isFeedRegion)).toBe(true);
    expect(isFeedRegion('NA')).toBe(false);
    expect(isFeedRegion(undefined)).toBe(false);
  });
});

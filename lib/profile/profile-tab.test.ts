import { describe, it, expect } from 'vitest';
import { parseProfileTab, profileTabUrl } from './profile-tab';

describe('parseProfileTab', () => {
  it('opens the decks tab from ?tab=decks', () => {
    expect(parseProfileTab('?tab=decks')).toBe('decks');
  });

  it('defaults to the collection tab', () => {
    expect(parseProfileTab('')).toBe('collection');
  });

  it('falls back to collection for an unknown tab', () => {
    expect(parseProfileTab('?tab=admin')).toBe('collection');
  });
});

describe('profileTabUrl', () => {
  it('adds tab=decks and keeps other query params', () => {
    expect(profileTabUrl('/profile/someone', '?ref=discord', 'decks')).toBe('/profile/someone?ref=discord&tab=decks');
  });

  it('drops the param for the default tab so the plain profile URL stays canonical', () => {
    expect(profileTabUrl('/profile/someone', '?tab=decks', 'collection')).toBe('/profile/someone');
  });
});

import { describe, it, expect } from 'vitest';
import { hidesMobileTabBar } from './mobile-tab-bar-visibility';

describe('hidesMobileTabBar', () => {
  it('hides on the deck editor, which has its own floating tab pill', () => {
    expect(hidesMobileTabBar('/decks/abc123')).toBe(true);
    expect(hidesMobileTabBar('/decks/abc123/')).toBe(true);
  });

  it('shows on the deck listing pages', () => {
    expect(hidesMobileTabBar('/decks/community')).toBe(false);
    expect(hidesMobileTabBar('/decks/to-beat')).toBe(false);
    expect(hidesMobileTabBar('/decks')).toBe(false);
  });

  it('hides on the scanner, where it covers the review rows and their buttons', () => {
    expect(hidesMobileTabBar('/scan')).toBe(true);
    expect(hidesMobileTabBar('/scan/lab')).toBe(true);
  });

  it('shows elsewhere', () => {
    expect(hidesMobileTabBar('/')).toBe(false);
    expect(hidesMobileTabBar('/opt')).toBe(false);
    expect(hidesMobileTabBar('/scanner-guide')).toBe(false);
  });
});

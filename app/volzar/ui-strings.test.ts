import { describe, it, expect } from 'vitest';
import { uiStrings, UI_STRINGS } from './ui-strings';

describe('uiStrings', () => {
  it('every language defines every key (no partial dictionaries)', () => {
    const keys = Object.keys(UI_STRINGS.en).sort();
    for (const [lang, dict] of Object.entries(UI_STRINGS)) {
      expect(Object.keys(dict).sort(), `language ${lang}`).toEqual(keys);
    }
  });

  it('interpolates the username into the greeting', () => {
    expect(uiStrings('fr').greeting('mistercakes')).toContain('mistercakes');
    expect(uiStrings('ja').greeting('mistercakes')).toContain('mistercakes');
  });

  it('falls back to English for unknown or missing languages', () => {
    expect(uiStrings(undefined).newChat).toBe('New chat');
    expect(uiStrings('xx').newChat).toBe('New chat');
  });

  it('localizes the rail launcher labels', () => {
    expect(uiStrings('fr').actions.binders).toBe('Mes classeurs');
    expect(uiStrings('da').actions.decks).toBe('Mine decks');
    expect(uiStrings('en').actions.results).toBe('Game results');
  });

  it('splits the ⚡ explainer around the icon slot in every language', () => {
    for (const dict of Object.values(UI_STRINGS)) {
      expect(dict.explainer).toHaveLength(2);
      expect(dict.explainer[1].length).toBeGreaterThan(20);
    }
  });
});

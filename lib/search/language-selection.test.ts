import { describe, it, expect } from 'vitest';
import { toggleLanguageSelection } from './language-selection';

// Model recap: ['en'] = English default, [] = ALL languages, [..codes] = those
// specific languages (OR'd in the query). The friction we're fixing: from the
// English default, picking another language used to ADD ('en' stayed stuck),
// giving English + that language. De-sticking makes the first explicit pick
// replace the default.
describe('toggleLanguageSelection', () => {
  it('replaces the sticky English default with the first non-English pick', () => {
    expect(toggleLanguageSelection(['en'], 'ja')).toEqual(['ja']);
    expect(toggleLanguageSelection(['en'], 'fr')).toEqual(['fr']);
  });

  it('adds further languages once the default has been de-stuck', () => {
    expect(toggleLanguageSelection(['ja'], 'de')).toEqual(['ja', 'de']);
  });

  it('toggles a selected language back off', () => {
    expect(toggleLanguageSelection(['ja', 'de'], 'ja')).toEqual(['de']);
  });

  it('lets English be unioned back in deliberately (not treated as default)', () => {
    expect(toggleLanguageSelection(['ja'], 'en')).toEqual(['ja', 'en']);
  });

  it('clicking English while on the English default clears to ALL languages', () => {
    // Existing behavior preserved: removing the only language => [] => all.
    expect(toggleLanguageSelection(['en'], 'en')).toEqual([]);
  });

  it('removing the last remaining language clears to ALL languages', () => {
    expect(toggleLanguageSelection(['ja'], 'ja')).toEqual([]);
  });
});

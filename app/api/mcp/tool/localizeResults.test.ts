// Localizing search_printings results: when options.language is a non-English
// code, each result printing is swapped to its closest printing in that
// language WHEN ONE EXISTS (same card, prefer same foiling/edition/set —
// pickLanguageVariant semantics), and the translated card name rides along as
// name_local. Cards with no printing in that language FALL BACK to the English
// printing untouched (the translated name still attaches when known).
import { describe, it, expect } from 'vitest';
import { normalizeResponseLanguage, localizeSearchOutput } from './localizeResults';

type Section = { index: number; query: string; total: number; printings: any[] };

const enPrinting = (overrides: Partial<any> = {}) => ({
  printing_id: 'pid_en',
  card_unique_id: 'cuid_estrike',
  collector_number: 'WTR159',
  name: 'Enlightened Strike',
  display_name: 'Enlightened Strike',
  set: 'wtr',
  edition: 'u',
  foiling: 's',
  rarity: 'm',
  pitch: 2,
  language: 'en',
  image_url: 'https://img/en.png',
  text: 'english rules text',
  tcg_low: 40,
  ...overrides,
});

const frCandidate = (overrides: Partial<any> = {}) => ({
  printing_id: 'pid_fr',
  card_unique_id: 'cuid_estrike',
  collector_number: '1HP361',
  set: '1hp',
  edition: 'n',
  foiling: 's',
  rarity: 'm',
  language: 'fr',
  image_url: 'https://img/fr.png',
  text: 'texte de règles français',
  tcg_low: null,
  ...overrides,
});

const frTranslation = {
  cardUniqueId: 'cuid_estrike',
  name: 'frappe éclairée',
  displayName: 'Frappe Éclairée',
};

describe('normalizeResponseLanguage', () => {
  it('accepts the supported non-English codes, case-insensitively', () => {
    expect(normalizeResponseLanguage('fr')).toBe('fr');
    expect(normalizeResponseLanguage('JA')).toBe('ja');
    expect(normalizeResponseLanguage('de')).toBe('de');
  });

  it('returns null for English, unknown codes, and missing values', () => {
    expect(normalizeResponseLanguage('en')).toBeNull();
    expect(normalizeResponseLanguage('zz')).toBeNull();
    expect(normalizeResponseLanguage(undefined)).toBeNull();
    expect(normalizeResponseLanguage('')).toBeNull();
  });
});

describe('localizeSearchOutput', () => {
  it('swaps the physical printing fields to the localized variant and attaches name_local', () => {
    const output: Section[] = [{ index: 0, query: 'enlightened strike', total: 1, printings: [enPrinting()] }];
    localizeSearchOutput(output, [frCandidate()], [frTranslation], 'fr');

    const p = output[0].printings[0];
    expect(p.printing_id).toBe('pid_fr');
    expect(p.collector_number).toBe('1HP361');
    expect(p.set).toBe('1hp');
    expect(p.language).toBe('fr');
    expect(p.image_url).toBe('https://img/fr.png');
    expect(p.text).toBe('texte de règles français');
    expect(p.name_local).toBe('Frappe Éclairée');
    // English name stays canonical; prices stay from the English printing
    // (localized printings carry no TCGplayer prices).
    expect(p.name).toBe('Enlightened Strike');
    expect(p.tcg_low).toBe(40);
  });

  it('prefers the candidate with matching foiling/edition/set', () => {
    const output: Section[] = [{ index: 0, query: 'x', total: 1, printings: [enPrinting({ foiling: 'r' })] }];
    localizeSearchOutput(
      output,
      [frCandidate({ printing_id: 'fr_nf', foiling: 's' }), frCandidate({ printing_id: 'fr_rf', foiling: 'r' })],
      [],
      'fr',
    );
    expect(output[0].printings[0].printing_id).toBe('fr_rf');
  });

  it('falls back to the English printing untouched when no localized printing exists', () => {
    const output: Section[] = [{ index: 0, query: 'x', total: 1, printings: [enPrinting()] }];
    localizeSearchOutput(output, [], [frTranslation], 'fr');

    const p = output[0].printings[0];
    expect(p.printing_id).toBe('pid_en');
    expect(p.language).toBe('en');
    expect(p.image_url).toBe('https://img/en.png');
    // The translated NAME still attaches when known (translation without printing).
    expect(p.name_local).toBe('Frappe Éclairée');
  });

  it('leaves cards with neither localized printing nor translation fully untouched', () => {
    const output: Section[] = [{ index: 0, query: 'x', total: 1, printings: [enPrinting({ card_unique_id: 'cuid_other' })] }];
    localizeSearchOutput(output, [frCandidate()], [frTranslation], 'fr');

    const p = output[0].printings[0];
    expect(p.printing_id).toBe('pid_en');
    expect(p.name_local).toBeUndefined();
  });

  it('only swaps to candidates of the same card and preserves printing_count', () => {
    const output: Section[] = [{
      index: 0,
      query: 'x',
      total: 2,
      printings: [
        enPrinting({ printing_count: 7 }),
        enPrinting({ printing_id: 'pid_other', card_unique_id: 'cuid_other', name: 'Other Card' }),
      ],
    }];
    localizeSearchOutput(output, [frCandidate()], [frTranslation], 'fr');

    expect(output[0].printings[0].printing_id).toBe('pid_fr');
    expect(output[0].printings[0].printing_count).toBe(7);
    expect(output[0].printings[1].printing_id).toBe('pid_other');
  });
});

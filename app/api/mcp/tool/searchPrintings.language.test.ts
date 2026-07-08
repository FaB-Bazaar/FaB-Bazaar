/**
 * search_printings options.language — multilingual localization.
 *
 * When the caller passes a supported non-English language, each result
 * printing is swapped to that language's printing WHEN ONE EXISTS (joined by
 * card_unique_id, closest foiling/edition/set) and the translated card name
 * rides along as name_local. Cards with no printing in that language fall
 * back to the English printing (translated name still attached when known).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn(),
    bulkResolveByName: vi.fn(),
    getCardTranslations: vi.fn(),
    getCardIdsByTranslatedName: vi.fn(),
  },
}));

import { searchPrintingsTool } from './searchPrintings';
import { printingsService } from '@/lib/services';

const mockBulk = vi.mocked(printingsService.bulkResolveByName);
const mockSearch = vi.mocked(printingsService.searchPrintings);
const mockTranslations = vi.mocked(printingsService.getCardTranslations);
const mockTranslatedName = vi.mocked(printingsService.getCardIdsByTranslatedName);

const EN_PRINTING = {
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
  color: 'yellow',
  types: ['generic', 'action', 'attack'],
  language: 'en',
  tcg_low: 40,
};

const FR_PRINTING = {
  printing_id: 'pid_fr',
  card_unique_id: 'cuid_estrike',
  collector_number: '1HP361',
  set: '1hp',
  edition: 'n',
  foiling: 's',
  rarity: 'm',
  language: 'fr',
  image_url: 'https://img/fr.png',
  text: 'texte français',
  tcg_low: null,
};

const FR_TRANSLATION = {
  cardUniqueId: 'cuid_estrike',
  language: 'fr',
  name: 'frappe éclairée',
  displayName: 'Frappe Éclairée',
  text: 'texte français',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBulk.mockResolvedValue({
    success: true,
    data: [{ name: 'enlightened strike', printings: [EN_PRINTING] }],
  } as any);
  mockSearch.mockResolvedValue({ success: true, data: { printings: [FR_PRINTING], total: 1 } } as any);
  mockTranslations.mockResolvedValue({ success: true, data: [FR_TRANSLATION] } as any);
  mockTranslatedName.mockResolvedValue({ success: true, data: [] } as any);
});

describe('search_printings options.language', () => {
  it('swaps results to the localized printing and attaches name_local', async () => {
    const result = await searchPrintingsTool.handler({
      cards: [{ query: 'enlightened strike' }],
      options: { language: 'fr' },
    });

    expect(result.success).toBe(true);
    const p = (result as any).results[0].printings[0];
    expect(p.printing_id).toBe('pid_fr');
    expect(p.collector_number).toBe('1HP361');
    expect(p.language).toBe('fr');
    expect(p.name_local).toBe('Frappe Éclairée');
    expect(p.name).toBe('Enlightened Strike');
    // Candidates were fetched by card id + language; translations too.
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ cardUniqueIds: ['cuid_estrike'], languages: ['fr'] }),
      expect.objectContaining({ groupByCard: false }),
    );
    expect(mockTranslations).toHaveBeenCalledWith(['cuid_estrike'], 'fr');
    // The model-facing message leads with the localized name and marks the language.
    expect((result as any).message).toContain('Frappe Éclairée');
    expect((result as any).message).toContain('Language: FR');
  });

  it('falls back to the English printing when no localized printing exists', async () => {
    mockSearch.mockResolvedValue({ success: true, data: { printings: [], total: 0 } } as any);

    const result = await searchPrintingsTool.handler({
      cards: [{ query: 'enlightened strike' }],
      options: { language: 'fr' },
    });

    const p = (result as any).results[0].printings[0];
    expect(p.printing_id).toBe('pid_en');
    expect(p.language).toBeUndefined(); // en is the default — not repeated per row
    expect(p.name_local).toBe('Frappe Éclairée');
    expect((result as any).message).toContain('no FR printing');
  });

  it('resolves a native-language card name via the translated-name fallback', async () => {
    // The English name search finds nothing for the French wording…
    mockBulk.mockResolvedValue({
      success: true,
      data: [{ name: 'frappe éclairée', printings: [] }],
    } as any);
    // …the translated-name lookup identifies the card…
    mockTranslatedName.mockResolvedValue({
      success: true,
      data: [{ cardUniqueId: 'cuid_estrike', language: 'fr', displayName: 'Frappe Éclairée' }],
    } as any);
    // …and searches serve the re-search (by card id) vs localization (languages).
    mockSearch.mockImplementation(async (filters: any) => {
      if (filters.languages) return { success: true, data: { printings: [FR_PRINTING], total: 1 } } as any;
      if (filters.cardUniqueIds) return { success: true, data: { printings: [EN_PRINTING], total: 1 } } as any;
      return { success: true, data: { printings: [], total: 0 } } as any;
    });

    const result = await searchPrintingsTool.handler({
      cards: [{ query: 'frappe éclairée' }],
      options: { language: 'fr' },
    });

    expect(mockTranslatedName).toHaveBeenCalledWith('frappe éclairée');
    const p = (result as any).results[0].printings[0];
    // Recovered AND localized: the FR printing with the translated name.
    expect(p.printing_id).toBe('pid_fr');
    expect(p.name_local).toBe('Frappe Éclairée');
    expect((result as any).message).toContain('matched by FR card name');
  });

  it('translated-name fallback works without options.language (English result)', async () => {
    mockBulk.mockResolvedValue({
      success: true,
      data: [{ name: 'frappe éclairée', printings: [] }],
    } as any);
    mockTranslatedName.mockResolvedValue({
      success: true,
      data: [{ cardUniqueId: 'cuid_estrike', language: 'fr', displayName: 'Frappe Éclairée' }],
    } as any);
    mockSearch.mockResolvedValue({ success: true, data: { printings: [EN_PRINTING], total: 1 } } as any);

    const result = await searchPrintingsTool.handler({
      cards: [{ query: 'frappe éclairée' }],
    });

    const p = (result as any).results[0].printings[0];
    expect(p.printing_id).toBe('pid_en');
    expect((result as any).message).toContain('matched by FR card name');
    expect(mockTranslations).not.toHaveBeenCalled();
  });

  it('does not try the translated-name fallback when the English search has results', async () => {
    await searchPrintingsTool.handler({
      cards: [{ query: 'enlightened strike' }],
      options: { language: 'fr' },
    });
    expect(mockTranslatedName).not.toHaveBeenCalled();
  });

  it('does no localization work for English or missing language', async () => {
    const result = await searchPrintingsTool.handler({
      cards: [{ query: 'enlightened strike' }],
      options: { language: 'en' },
    });

    const p = (result as any).results[0].printings[0];
    expect(p.printing_id).toBe('pid_en');
    expect(p.name_local).toBeUndefined();
    expect(mockTranslations).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

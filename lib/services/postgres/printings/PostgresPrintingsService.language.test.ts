/**
 * Integration test: PostgresPrintingsService surfaces the printings.language
 * field on the PrintingDTO returned by searchPrintings.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local AND
 * non-English printings to exist in the DB (run scripts/import-i18n.ts first
 * if running against a fresh DB).
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService — language field', () => {
  it('includes `language` on each printing in searchPrintings results', async () => {
    const result = await service.searchPrintings({}, { limit: 5 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.printings.length).toBeGreaterThan(0);
    for (const printing of result.data.printings) {
      // Every row in our DB has language NOT NULL DEFAULT 'en', so every DTO
      // should carry a non-empty string here.
      expect(printing.language).toBeTypeOf('string');
      expect(printing.language.length).toBeGreaterThan(0);
    }
  });

  it('returns non-English values when those printings exist', async () => {
    // Fyendal's Spring Tunic has French/German/Italian/Spanish/Japanese
    // printings in our DB from the LSS sync.
    const result = await service.searchPrintings({ name: "Fyendal's Spring Tunic" }, { limit: 100 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const languagesSeen = new Set(result.data.printings.map((p) => p.language));
    // At minimum we expect en + at least one non-en
    expect(languagesSeen.has('en')).toBe(true);
    expect(languagesSeen.size).toBeGreaterThan(1);
  });
});

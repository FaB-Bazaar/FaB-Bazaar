/**
 * validatePrintingIds — shape guard for the `printingIds` param on curation
 * tools (add_card_to_list / remove_card_from_list).
 *
 * Ground truth (verified against prod-shaped DB, 2026-07-08): printings.
 * printing_id is a 21-char nanoid in 43,414/43,414 rows and NEVER looks like
 * a collector number ("wtr001"/"AGB019" live in the separate collector_number
 * column). Card entry IDs share the same nanoid shape, so the two are NOT
 * distinguishable by shape — the validator must accept nanoids and instead
 * reject collector-number-style strings, which users paste by mistake and
 * which previously got stored as broken unresolved rows.
 */
import { describe, it, expect } from 'vitest';
import { validatePrintingIds } from './helpers';

// Real printing_id values sampled from the DB (Sawbones, Dock Hand + others).
const REAL_PRINTING_IDS = [
  'MNBr6rcNTHmKqGQcpqTBm', // agb AGB019 (mixed case, 21 chars)
  'wNC6JHHK766wMPmPdkwcN', // sea SEA264
  '5CxKrMgtpbrDNYYUVVlM-', // trailing dash — nanoid alphabet includes -_
  'o-f7_kvCiNDmcjN05d85v', // dash + underscore inside
  'niDNgjg1EFKfYPAKn3ier',
];

describe('validatePrintingIds', () => {
  it('accepts real 21-char nanoid printing IDs (the only shape that exists in the DB)', () => {
    expect(validatePrintingIds(REAL_PRINTING_IDS)).toBeNull();
  });

  it('accepts a single nanoid printing ID', () => {
    expect(validatePrintingIds(['cLHGKMCjPb89zwNPmMFBp'])).toBeNull();
  });

  it('rejects collector-number-style strings, pointing at search_printings', () => {
    const err = validatePrintingIds(['agb019']);
    expect(err).not.toBeNull();
    expect(err).toMatch(/collector number/i);
    expect(err).toMatch(/search_printings/);
    expect(err).toContain('agb019');
  });

  it('rejects mixed collector-number styles (upper case, suffixed)', () => {
    const err = validatePrintingIds(['WTR001', 'dyn043-cf']);
    expect(err).not.toBeNull();
    expect(err).toMatch(/collector number/i);
  });

  it('flags only the bad values when mixed with real printing IDs', () => {
    const err = validatePrintingIds(['MNBr6rcNTHmKqGQcpqTBm', 'agb019']);
    expect(err).not.toBeNull();
    expect(err).toContain('agb019');
    expect(err).not.toContain('MNBr6rcNTHmKqGQcpqTBm');
  });

  it('rejects UUIDs (wrong system entirely)', () => {
    expect(validatePrintingIds(['123e4567-e89b-12d3-a456-426614174000'])).not.toBeNull();
  });

  it('rejects card-name strings passed as IDs', () => {
    expect(validatePrintingIds(['Sawbones, Dock Hand'])).not.toBeNull();
  });

  it('returns null for undefined / empty input', () => {
    expect(validatePrintingIds(undefined)).toBeNull();
    expect(validatePrintingIds([])).toBeNull();
  });
});

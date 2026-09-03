/**
 * printingLabel() — the human identity of one printing for trade pings
 * and match tiles: "<FOIL> <name> (<collector>)". Foil and collector
 * number are what stop a Discord ping from reading as "any copy of X"
 * when the match was on one exact printing.
 */

import { describe, it, expect } from 'vitest';
import { printingLabel } from './printing-label';

describe('printingLabel', () => {
  it('prefixes the foil label and suffixes the collector number', () => {
    expect(printingLabel({ displayName: 'Crown of Dominion', foiling: 'RF', collectorNumber: 'MON306' }))
      .toBe('RF Crown of Dominion (MON306)');
  });

  it('omits the foil prefix for non-foil', () => {
    expect(printingLabel({ displayName: 'Dig Up Dinner', foiling: 'NF', collectorNumber: 'SEA015' }))
      .toBe('Dig Up Dinner (SEA015)');
  });

  it('falls back to the bare name when there is no collector number', () => {
    expect(printingLabel({ displayName: 'Pounamu Amulet', foiling: 'NF', collectorNumber: null }))
      .toBe('Pounamu Amulet');
    expect(printingLabel({ displayName: 'Pounamu Amulet', foiling: 'CF' }))
      .toBe('CF Pounamu Amulet');
  });
});

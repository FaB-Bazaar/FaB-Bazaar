import { describe, it, expect } from 'vitest';
import { fabConstantsResource } from './fabConstants';

describe('fabConstantsResource', () => {
  it('clarifies that enum-style filter values are case-insensitive (only collector numbers are case-sensitive)', async () => {
    const data = await (fabConstantsResource as any).handler();
    const serialized = JSON.stringify(data);

    expect(serialized).toMatch(/case.?insensitive|any case|case.?independent/i);
    expect(serialized).toMatch(/collector.?number|card.?id/i);
  });

  it('disambiguates classes (card class) vs heroClasses (hero legality) at the top level', async () => {
    const data = await (fabConstantsResource as any).handler();
    const serialized = JSON.stringify(data);

    expect(serialized).toMatch(/heroClasses/);
    expect(serialized).toMatch(/classes.*card.?class|card.?class.*classes/i);
    expect(serialized).toMatch(/legal.*hero|hero.*legal/i);
  });

  it('generates core_sets from the curated set list so newest sets are present', async () => {
    const data = await (fabConstantsResource as any).handler();
    const coreSets = data.set_mappings.core_sets;

    // Newest standard sets that the old hand-maintained list omitted
    expect(coreSets).toHaveProperty('pen');
    expect(coreSets).toHaveProperty('omn');
    // Classic anchor still present
    expect(coreSets).toHaveProperty('wtr');
    // Values are human-readable set names, not the bare code
    expect(coreSets.pen).not.toBe('pen');
  });

  it('never advertises the dead "hp1"/"hp2" set codes (DB uses 1hp/2hp)', async () => {
    const data = await (fabConstantsResource as any).handler();
    const serialized = JSON.stringify(data);

    expect(serialized).not.toMatch(/hp1/);
    expect(serialized).not.toMatch(/hp2/);
    // and the working codes ARE present in the WB guidance
    expect(serialized).toMatch(/1hp/);
  });
});

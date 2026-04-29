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
});

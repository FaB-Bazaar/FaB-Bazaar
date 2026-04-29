import { describe, it, expect } from 'vitest';
import { searchCapabilitiesResource } from './searchCapabilities';

describe('searchCapabilitiesResource', () => {
  it('disambiguates classes (card class) vs heroClasses (hero legality, includes generics)', async () => {
    const data = await searchCapabilitiesResource.handler();
    const serialized = JSON.stringify(data);

    expect(serialized).toMatch(/classes.*card.?class|card.?class.*classes/i);
    expect(serialized).toMatch(/heroClasses.*legal|legal.*heroClasses/i);
    expect(serialized).toMatch(/generic/i);
  });

  it('notes that enum-style filters accept any case', async () => {
    const data = await searchCapabilitiesResource.handler();
    const serialized = JSON.stringify(data);

    expect(serialized).toMatch(/case.?insensitive|any case|lowercase|uppercase/i);
  });
});

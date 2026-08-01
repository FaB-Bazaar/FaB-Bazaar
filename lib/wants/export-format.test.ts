import { describe, it, expect } from 'vitest';
import { formatWantsExportLine, formatWantsExport } from './export-format';

// Cards arrive in the owner-page UI shape: lowercase `name` at the top level,
// full printing row under `printingDetails` (see app/api/wants/route.ts GET).
const baseCard = {
  quantity: 2,
  name: 'silverwind shuriken',
  is_extended_art: false,
  printingDetails: {
    display_name: 'Silverwind Shuriken',
    color: '',
    pitch: null as number | null,
    set: 'out',
    collector_number: 'OUT093',
    edition: 'n',
    rarity: 'm',
    foiling: 'r',
  },
};

const card = (overrides: Record<string, any> = {}, printingOverrides: Record<string, any> = {}) => ({
  ...baseCard,
  ...overrides,
  printingDetails: { ...baseCard.printingDetails, ...printingOverrides },
});

describe('formatWantsExportLine', () => {
  it('uses display_name and omits pitch color for colorless cards', () => {
    expect(formatWantsExportLine(card())).toBe(
      '2x Silverwind Shuriken (OUT093, Majestic, Rainbow Foil)'
    );
  });

  it('includes the pitch color after the name', () => {
    const line = formatWantsExportLine(
      card({ quantity: 3, name: 'ice quake' }, {
        display_name: 'Ice Quake',
        color: 'blue',
        pitch: 3,
        set: 'ele',
        collector_number: 'ELE047',
        rarity: 'r',
        foiling: 's',
      })
    );
    expect(line).toBe('3x Ice Quake (blue) (ELE047, Rare, Non-foil)');
  });

  it('derives the color from pitch when color is empty', () => {
    const line = formatWantsExportLine(card({}, { color: '', pitch: 1 }));
    expect(line).toBe('2x Silverwind Shuriken (red) (OUT093, Majestic, Rainbow Foil)');
  });

  it('includes notable editions after the collector number', () => {
    const line = formatWantsExportLine(
      card({ quantity: 1, name: 'eye of ophidia' }, {
        display_name: 'Eye of Ophidia',
        color: 'blue',
        pitch: 3,
        set: 'arc',
        collector_number: 'ARC000',
        edition: 'f',
        rarity: 'f',
        foiling: 'r',
      })
    );
    expect(line).toBe('1x Eye of Ophidia (blue) (ARC000, First Edition, Fabled, Rainbow Foil)');
  });

  it('omits the Normal edition as noise', () => {
    expect(formatWantsExportLine(card({}, { edition: 'n' }))).toBe(
      '2x Silverwind Shuriken (OUT093, Majestic, Rainbow Foil)'
    );
  });

  it('falls back to the uppercased set code when collector number is missing', () => {
    const line = formatWantsExportLine(card({}, { collector_number: undefined }));
    expect(line).toBe('2x Silverwind Shuriken (OUT, Majestic, Rainbow Foil)');
  });

  it('falls back to capitalized name when display_name is missing', () => {
    const line = formatWantsExportLine(card({}, { display_name: undefined }));
    expect(line).toBe('2x Silverwind Shuriken (OUT093, Majestic, Rainbow Foil)');
  });

  it('omits foiling instead of claiming Non-foil when foiling is missing', () => {
    const line = formatWantsExportLine(card({}, { foiling: undefined }));
    expect(line).toBe('2x Silverwind Shuriken (OUT093, Majestic)');
  });

  it('tags extended art printings', () => {
    const line = formatWantsExportLine(card({ is_extended_art: true }));
    expect(line).toBe('2x Silverwind Shuriken (OUT093, Majestic, Rainbow Foil, Extended Art)');
  });
});

describe('formatWantsExport', () => {
  it('joins lines with newlines preserving the given order', () => {
    const cards = [
      card(),
      card({ quantity: 1, name: 'ice quake' }, {
        display_name: 'Ice Quake',
        color: 'blue',
        collector_number: 'ELE047',
        rarity: 'r',
        foiling: 's',
      }),
    ];
    expect(formatWantsExport(cards)).toBe(
      '2x Silverwind Shuriken (OUT093, Majestic, Rainbow Foil)\n' +
        '1x Ice Quake (blue) (ELE047, Rare, Non-foil)'
    );
  });
});

import { describe, it, expect } from 'vitest';
import { findExistingMatchupToEdit } from './matchup-edit-mode';

const arakni = {
  heroId: 'arakni_huntsman',
  preferredTurnOrder: 'NoPreference' as const,
  notes: 'Existing notes',
  sideboard: { in: ['x_red'], out: ['y_red'] },
};
const briar = {
  heroId: 'briar_warden_of_thorns',
  preferredTurnOrder: 'First' as const,
  notes: null,
  sideboard: { in: [], out: [] },
};

describe('findExistingMatchupToEdit', () => {
  it('returns the matching matchup when the picked hero already has one', () => {
    const result = findExistingMatchupToEdit([arakni, briar], 'arakni_huntsman', null);
    expect(result).toEqual(arakni);
  });

  it('returns null when no matchup matches the picked hero', () => {
    const result = findExistingMatchupToEdit([briar], 'arakni_huntsman', null);
    expect(result).toBeNull();
  });

  it('returns null when no hero is picked', () => {
    const result = findExistingMatchupToEdit([arakni], '', null);
    expect(result).toBeNull();
  });

  it('returns null when already editing (avoids clobbering in-progress edits)', () => {
    const result = findExistingMatchupToEdit([arakni], 'arakni_huntsman', 'arakni_huntsman');
    expect(result).toBeNull();
  });

  it('returns null when editing a different hero', () => {
    const result = findExistingMatchupToEdit([arakni, briar], 'arakni_huntsman', 'briar_warden_of_thorns');
    expect(result).toBeNull();
  });
});

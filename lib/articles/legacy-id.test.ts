import { describe, it, expect } from 'vitest';
import { isLegacyHexId } from './legacy-id';

// Mirrors mongoose.Types.ObjectId.isValid for string input (verified against the
// installed mongoose before it was removed): only 24 hex chars, either case.
describe('isLegacyHexId', () => {
  it.each(['507f1f77bcf86cd799439011', '507F1F77BCF86CD799439011'])('accepts %s', (id) => {
    expect(isLegacyHexId(id)).toBe(true);
  });

  it.each([
    'g4zzA4Ev_Q',                             // publicId
    'cLHGKMCjPb89zwNPmMFBp',                  // nanoid article id
    'abcdefghijkl',                           // 12 chars
    '507f1f77bcf86cd79943901z',               // 24 chars, not hex
    '507f1f77bcf86cd7994390111',              // 25 hex
    '550e8400-e29b-41d4-a716-446655440000',   // uuid
    '',
  ])('rejects %s', (id) => {
    expect(isLegacyHexId(id)).toBe(false);
  });
});

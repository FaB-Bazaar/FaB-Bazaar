// lib/collection/tag-utils.test.ts
import { describe, it, expect } from 'vitest';
import { addTags, removeTag } from './tag-utils';

describe('addTags', () => {
  it('appends a new tag', () => {
    expect(addTags(['inventory'], 'nm')).toEqual(['inventory', 'nm']);
  });

  it('trims surrounding whitespace', () => {
    expect(addTags(['inventory'], '  trades  ')).toEqual(['inventory', 'trades']);
  });

  it('ignores empty / whitespace-only input', () => {
    expect(addTags(['inventory'], '   ')).toEqual(['inventory']);
    expect(addTags(['inventory'], '')).toEqual(['inventory']);
  });

  it('dedupes case-insensitively against existing tags', () => {
    expect(addTags(['Inventory'], 'inventory')).toEqual(['Inventory']);
  });

  it('splits comma-separated input into multiple tags', () => {
    expect(addTags([], 'inventory, nm, trades')).toEqual(['inventory', 'nm', 'trades']);
  });

  it('dedupes within the same comma-separated input', () => {
    expect(addTags([], 'nm, NM, nm')).toEqual(['nm']);
  });

  it('preserves existing tags and their order', () => {
    expect(addTags(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });
});

describe('removeTag', () => {
  it('removes a tag case-insensitively', () => {
    expect(removeTag(['Inventory', 'trades'], 'inventory')).toEqual(['trades']);
  });

  it('leaves the array unchanged when the tag is absent', () => {
    expect(removeTag(['inventory'], 'nope')).toEqual(['inventory']);
  });
});

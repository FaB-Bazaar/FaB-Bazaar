import { describe, it, expect } from 'vitest';
import { collectDeckFolders, matchesFolderFilter, NO_FOLDER, ALL_FOLDERS } from './deck-folders';

describe('collectDeckFolders', () => {
  it('returns distinct folder names sorted case-insensitively, skipping unfiled decks', () => {
    const decks = [
      { folder: 'Physical decks' },
      { folder: null },
      { folder: 'brewing' },
      { folder: undefined },
      { folder: 'Physical decks' },
      { folder: 'Archive' },
    ];
    expect(collectDeckFolders(decks)).toEqual(['Archive', 'brewing', 'Physical decks']);
  });

  it('returns [] when no deck has a folder', () => {
    expect(collectDeckFolders([{ folder: null }, {}])).toEqual([]);
  });
});

describe('matchesFolderFilter', () => {
  it('ALL_FOLDERS matches every deck', () => {
    expect(matchesFolderFilter({ folder: 'A' }, ALL_FOLDERS)).toBe(true);
    expect(matchesFolderFilter({ folder: null }, ALL_FOLDERS)).toBe(true);
  });

  it('NO_FOLDER matches only unfiled decks', () => {
    expect(matchesFolderFilter({ folder: null }, NO_FOLDER)).toBe(true);
    expect(matchesFolderFilter({}, NO_FOLDER)).toBe(true);
    expect(matchesFolderFilter({ folder: 'A' }, NO_FOLDER)).toBe(false);
  });

  it('a folder name matches exactly that folder', () => {
    expect(matchesFolderFilter({ folder: 'Physical decks' }, 'Physical decks')).toBe(true);
    expect(matchesFolderFilter({ folder: 'physical decks' }, 'Physical decks')).toBe(false);
    expect(matchesFolderFilter({ folder: null }, 'Physical decks')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { getPromptByName } from './index';

const promptText = (args: Record<string, string>) => {
  const prompt = getPromptByName('build-deck');
  if (!prompt) throw new Error('build-deck prompt missing');
  return prompt.handler(args).messages[0].content.text;
};

describe('build-deck prompt', () => {
  it('starts from the deckbuilding guide with the hero and format', () => {
    const text = promptText({ hero: 'dorinthea ironsong', format: 'Classic Constructed' });
    expect(text).toMatch(/get_deckbuilding_guide/);
    expect(text).toMatch(/dorinthea ironsong/);
    expect(text).toMatch(/Classic Constructed/);
  });

  it('researches recent decks and the hero-legal pool before recommending', () => {
    const text = promptText({ hero: 'dorinthea ironsong' });
    const ask = text.search(/stop and ask/i);
    expect(ask).toBeGreaterThan(-1);
    expect(text.indexOf('get_decks_to_beat')).toBeLessThan(ask);
    expect(text.indexOf('heroLegal')).toBeLessThan(ask);
  });

  it('does not build until the user has picked a direction', () => {
    const text = promptText({ hero: 'dorinthea ironsong' });
    expect(text.search(/stop and ask/i)).toBeLessThan(text.indexOf('create_deck'));
  });

  it('forbids cards that no tool returned', () => {
    expect(promptText({ hero: 'dorinthea ironsong' })).toMatch(/only name[^.]*cards a tool returned/i);
  });

  it('offers to check the collection when signed in', () => {
    expect(promptText({ hero: 'dorinthea ironsong' })).toMatch(/compare_collection_to_decks_to_beat/);
  });
});

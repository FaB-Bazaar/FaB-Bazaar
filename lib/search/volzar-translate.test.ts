/**
 * Volzar scope on /opt: plain English → structured /opt state. The LLM is
 * asked for a JSON PrintingsSearchFilters object; everything here is the pure
 * half — extracting that JSON, sanitising it against the real vocabulary so a
 * hallucinated class/keyword can never reach the search, and mapping it onto
 * OptUiState (chips + query + scope) via the existing filters→/opt mapper.
 */
import { describe, it, expect } from 'vitest';
import { parseTranslation, translationToOptState, buildTranslateSystemPrompt } from './volzar-translate';

describe('parseTranslation', () => {
  it('extracts a JSON object from a plain reply', () => {
    expect(parseTranslation('{"classes":["ninja"],"color":"blue","keywords":["go again"]}'))
      .toEqual({ classes: ['ninja'], color: 'blue', keywords: ['go again'] });
  });

  it('tolerates a ```json fence and surrounding prose', () => {
    const raw = 'Sure — here you go:\n```json\n{"classes":["ninja"],"pitch":3}\n```\nAnything else?';
    expect(parseTranslation(raw)).toEqual({ classes: ['ninja'], pitch: 3 });
  });

  it('drops unknown keys and hallucinated values, keeps the valid ones', () => {
    const out = parseTranslation(JSON.stringify({
      classes: ['ninja', 'paladin'],            // paladin is not a FaB class
      keywords: ['go again', 'haste'],          // haste is not a FaB keyword
      types: ['attack', 'sorcery'],
      rarities: ['m', 'x'],
      pitch: 7,                                 // out of range → dropped
      priceMax: 5,
      heroLegal: 'Dorinthea',                   // no chip — carried into the query as hero:
      sql: 'DROP TABLE cards',                  // unknown key
    }));
    expect(out).toEqual({
      classes: ['ninja'], keywords: ['go again'], types: ['attack'], rarities: ['m'],
      priceMax: 5, heroLegal: 'Dorinthea',
    });
  });

  it('lower-cases class / keyword / type values and accepts colour names for pitch', () => {
    expect(parseTranslation('{"classes":["Ninja"],"keywords":["Go Again"],"types":["Attack"],"color":"Blue"}'))
      .toEqual({ classes: ['ninja'], keywords: ['go again'], types: ['attack'], color: 'blue' });
  });

  it('returns null when there is no JSON object at all', () => {
    expect(parseTranslation('I could not understand that.')).toBeNull();
  });
});

describe('translationToOptState', () => {
  it('blue ninja go again → pitch chip + class chip + keyword chip, empty name query, Name scope', () => {
    const s = translationToOptState({ classes: ['ninja'], color: 'blue', keywords: ['go again'] });
    expect(s.selectedPitch).toEqual([3]);
    expect(s.selectedClasses).toEqual(['ninja']);
    expect(s.selectedKeywords).toEqual(['go again']);
    expect(s.query).toBe('');
    expect(s.searchMode).toBe('name');
  });

  it('a rules-text search lands in Text scope with the phrase as the query', () => {
    const s = translationToOptState({ text: 'deal arcane damage', classes: ['wizard'] });
    expect(s.query).toBe('deal arcane damage');
    expect(s.searchMode).toBe('text');
    expect(s.selectedClasses).toEqual(['wizard']);
  });

  it('a card-name search keeps the name as the query in Name scope', () => {
    const s = translationToOptState({ name: 'command and conquer', foilings: ['r'] });
    expect(s.query).toBe('command and conquer');
    expect(s.searchMode).toBe('name');
    expect(s.selectedFoilings).toEqual(['r']);
  });

  it('a hero request becomes a hero: shorthand token in the query (there is no hero chip)', () => {
    const s = translationToOptState({ heroLegal: 'Dorinthea', rarities: ['m'] });
    expect(s.query).toBe('hero:dorinthea');
    expect(s.selectedRarities).toEqual(['m']);
  });

  it('always resets every filter field it does not set (a new question replaces the old chips)', () => {
    const s = translationToOptState({ classes: ['ninja'] });
    expect(s.selectedKeywords).toEqual([]);
    expect(s.selectedSets).toEqual([]);
    expect(s.priceMax).toBe('');
  });
});

describe('buildTranslateSystemPrompt', () => {
  it('lists the real vocabulary so the model has nothing to guess', () => {
    const p = buildTranslateSystemPrompt();
    expect(p).toContain('ninja');
    expect(p).toContain('go again');
    expect(p).toContain('defense reaction');
    expect(p).toContain('future_cc');
    expect(p).toMatch(/JSON/);
  });
});

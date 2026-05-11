import { describe, expect, test } from 'vitest';
import { pickKitForStep } from './kit-routing';

const kits = (names: string[]) => names.map((name) => ({ id: name, name }));

describe('pickKitForStep', () => {
  test('matches gear step to "Equipment & Weapons" kit', () => {
    const result = pickKitForStep('gear', kits(['Equipment & Weapons', 'Attack Actions', 'Blocks']));
    expect(result?.name).toBe('Equipment & Weapons');
  });

  test('matches gear step to a "Weapons" kit when no Equipment kit exists', () => {
    const result = pickKitForStep('gear', kits(['Weapons Only', 'Attack Actions']));
    expect(result?.name).toBe('Weapons Only');
  });

  test('matches attacks step to "Attack Actions" kit', () => {
    const result = pickKitForStep('attacks', kits(['Attack Actions', 'Blocks']));
    expect(result?.name).toBe('Attack Actions');
  });

  test('matches defense step to "Defense Reactions" kit', () => {
    const result = pickKitForStep('defense', kits(['Defense Reactions', 'Attack Actions']));
    expect(result?.name).toBe('Defense Reactions');
  });

  test('matches defense step to "Blocks" kit when no Defense Reactions kit exists', () => {
    const result = pickKitForStep('defense', kits(['Blocks', 'Attack Actions']));
    expect(result?.name).toBe('Blocks');
  });

  test('prefers Defense Reactions over Blocks when both exist', () => {
    const result = pickKitForStep('defense', kits(['Blocks', 'Defense Reactions']));
    expect(result?.name).toBe('Defense Reactions');
  });

  test('matches utility step to "Non-Attack Actions" kit', () => {
    const result = pickKitForStep('utility', kits(['Non-Attack Actions', 'Attack Actions']));
    expect(result?.name).toBe('Non-Attack Actions');
  });

  test('matches utility step to "Allies" or "Gems" kit when no Non-Attack kit exists', () => {
    const result = pickKitForStep('utility', kits(['Allies', 'Attack Actions']));
    expect(result?.name).toBe('Allies');
  });

  test('match is case-insensitive', () => {
    const result = pickKitForStep('gear', kits(['EQUIPMENT & WEAPONS']));
    expect(result?.name).toBe('EQUIPMENT & WEAPONS');
  });

  test('returns null when no kit matches the step', () => {
    const result = pickKitForStep('gear', kits(['Attack Actions', 'Blocks']));
    expect(result).toBeNull();
  });

  test('returns null when no kits are available', () => {
    const result = pickKitForStep('attacks', []);
    expect(result).toBeNull();
  });

  test('returns the full kit object so caller can pass it to setPreviewBuild', () => {
    const myKits = [{ id: 'kit-1', name: 'Equipment & Weapons', extra: 'data' }];
    const result = pickKitForStep('gear', myKits);
    expect(result).toBe(myKits[0]);
  });
});

/**
 * Integration tests for getScanNameIndex — the card-name vocabulary the banner scanner matches OCR text against
 * (lib/scan/banner/name-match.ts). Runs against local Postgres (POSTGRES_URL in .env.local).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();
type Entry = { name: string; pitches: Array<number | null>; translations: string[] };
let entries: Entry[];

beforeAll(async () => {
  const res = await service.getScanNameIndex();
  expect(res.success).toBe(true);
  if (res.success) entries = res.data;
});

describe('PostgresPrintingsService.getScanNameIndex', () => {
  it('lists each card name once, with every pitch it is printed in', () => {
    const sink = entries.filter(e => e.name === 'Sink Below');
    expect(sink).toHaveLength(1);
    expect([...sink[0].pitches].sort()).toEqual([1, 2, 3]);
  });

  it('uses display names (proper capitalisation), not the lowercase search name', () => {
    expect(entries.some(e => e.name === 'Tempestuous Kiss')).toBe(true);
    expect(entries.some(e => e.name === 'tempestuous kiss')).toBe(false);
  });

  it('marks pitchless cards with a null pitch', () => {
    const perch = entries.find(e => e.name === 'Perch Grapplers');
    expect(perch?.pitches).toEqual([null]);
  });

  it('carries the de/es/fr/it translations of a card name', () => {
    expect(entries.find(e => e.name === 'Perch Grapplers')?.translations).toContain('Kantengreifer');
    expect(entries.find(e => e.name === 'Dread Triptych')?.translations).toContain('Tríptico del terror');
  });

  it('covers the whole card pool', () => {
    expect(entries.length).toBeGreaterThan(3000);
  });
});

/**
 * Guard: app code must not read, filter on, or return the retired card flags
 * (lib/search/retired-card-flags.ts) — the columns are about to be dropped.
 * Allowed: the Drizzle schema (the columns still exist and are still written),
 * the retired-flags list itself, and the MCP tool's detector, which names them
 * only through RETIRED_CARD_FLAGS.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RETIRED_CARD_FLAGS } from './retired-card-flags';

const ROOTS = ['app', 'components', 'lib', 'hooks', 'contexts', 'types'];
const SKIP = /(\.test\.|lib\/postgres\/schema\.ts$|lib\/postgres\/migrations\/|lib\/search\/retired-card-flags\.ts$)/;

const snake = (camel: string) => camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const NAMES = RETIRED_CARD_FLAGS.flatMap((f) => [f, snake(f)]);
const PATTERN = new RegExp(`\\b(?:${NAMES.join('|')})\\b`);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules') return [];
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(p) && !SKIP.test(p) ? [p] : [];
  });
}

describe('retired card flags are not used by the app', () => {
  it('no source file names a retired flag', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8').split('\n')
        .filter((line) => PATTERN.test(line))
        .map((line) => `${file}: ${line.trim()}`));
    expect(offenders).toEqual([]);
  });

  it('the pattern matches both spellings', () => {
    expect(PATTERN.test('isToken: cards.isToken,')).toBe(true);
    expect(PATTERN.test('played_horizontally: row.playedHorizontally || false,')).toBe(true);
    expect(PATTERN.test('isTokenized: true')).toBe(false);
  });
});

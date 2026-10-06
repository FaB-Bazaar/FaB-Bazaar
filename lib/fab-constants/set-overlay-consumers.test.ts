/**
 * Guard: nothing may COPY the set constants at module load.
 *
 * The runtime set overlay (set-overlay.ts) patches CARD_FILTER_SETS, SET_MAP,
 * SET_METADATA, SET_IMAGES and SET_FILTER_GROUPS in place after a set is
 * registered from /admin/cardvault. Aliasing (`const DISPLAY_SETS =
 * CARD_FILTER_SETS`) or reading inside a function sees the change; a
 * module-level copy (`[...CARD_FILTER_SETS]`, `new Set(CARD_FILTER_SETS)`,
 * `Object.keys(SET_MAP)`) freezes the compiled list forever — the /opt set
 * picker hid a newly registered set exactly this way.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'components', 'lib', 'hooks', 'contexts'];
const SKIP = /(\.test\.|lib\/fab-constants\/sets(-data\.generated)?\.ts$|lib\/fab-constants\/set-overlay)/;
const NAMES = 'CARD_FILTER_SETS|SET_MAP|SET_METADATA|SET_IMAGES|SET_FILTER_GROUPS';
// A top-level (column-0) const/let whose initializer copies or derives from a set constant.
const MODULE_COPY = new RegExp(
  `^(?:export\\s+)?(?:const|let)\\s+\\w+[^=]*=\\s*(?:new\\s+(?:Set|Map)\\s*(?:<[^>]*>)?\\(\\s*(?:${NAMES})\\b|\\[\\s*\\.\\.\\.(?:${NAMES})\\b|Object\\.(?:keys|values|entries)\\(\\s*(?:${NAMES})\\b|(?:${NAMES})\\s*\\.\\s*(?:map|filter|slice|concat)\\(|(?:getOrderedSets|getAllSetCodes|getSetsInDisplayOrder|getSetCodesInDisplayOrder)\\s*\\()`,
  'm');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules') return [];
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(p) && !SKIP.test(p) ? [p] : [];
  });
}

describe('set constants are never copied at module load', () => {
  it('finds no module-level copies', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8').split('\n')
        .filter((line) => MODULE_COPY.test(line))
        .map((line) => `${file}: ${line.trim()}`));
    expect(offenders).toEqual([]);
  });

  it('the pattern catches the real cases it exists for', () => {
    expect(MODULE_COPY.test('export const OPT_FILTER_SETS: string[] = [...CARD_FILTER_SETS];')).toBe(true);
    expect(MODULE_COPY.test('const SET_SET = new Set<string>(CARD_FILTER_SETS);')).toBe(true);
    expect(MODULE_COPY.test('const CODES = Object.keys(SET_MAP);')).toBe(true);
    expect(MODULE_COPY.test('const ORDERED = getOrderedSets();')).toBe(true);
    expect(MODULE_COPY.test('const DISPLAY_SETS = CARD_FILTER_SETS;')).toBe(false);
    expect(MODULE_COPY.test('  const local = [...CARD_FILTER_SETS];')).toBe(false);
  });
});

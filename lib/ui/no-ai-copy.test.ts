/**
 * Guard: no stock "generated site" copy in the UI (2026-09 audit).
 *
 * Banned in user-facing code: decorative emoji used as icons or bullets
 * (✅ 🔥 ✨ 🎉 👑 💎 …) and stock marketing phrases ("the ultimate …",
 * "effortless", "seamless"). Rarity has real icons (components/shared/RarityIcon);
 * copy should say something specific instead.
 *
 * Code comments and server-side console logs are ignored — users never see them.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'components'];
const SKIP = /(\.test\.|\/api\/|components\/testing\/)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(p) && !SKIP.test(p) ? [p] : [];
  });
}

const PATTERNS: [string, RegExp][] = [
  ['decorative emoji', /[✅✨🚀🎉🔥🌟👑💎💠🪙🎁⭐⚪]/u],
  ['stock marketing phrase', /\bthe ultimate\b|\beffortless(ly)?\b|\bseamless(ly)?\b/i],
];

// Strip what users never see: // comments, {/* */} blocks, console.* calls.
const visible = (line: string) =>
  line
    .replace(/\{?\/\*.*?\*\/\}?/g, '')
    .replace(/(^|[^:])\/\/.*$/, '$1')
    .replace(/console\.\w+\(.*$/, '');

describe('no stock generated-site copy', () => {
  it('app/ and components/ show no decorative emoji or stock marketing phrases', () => {
    const hits: string[] = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const text = visible(line);
        for (const [label, re] of PATTERNS) {
          if (re.test(text)) hits.push(`${file}:${i + 1} ${label}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});

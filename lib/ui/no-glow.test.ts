/**
 * Guard: no "AI glow" styling in the UI (2026-09 — users find it tacky).
 *
 * Banned: blurred colour halos (`shadow-[0_0_Npx_rgba(...)]` with a spread
 * of 4px+, coloured `shadow-blue-500/20`-style shadows, the `attention-glow`
 * pulse, `blur-2xl/3xl` background blobs). State stays visible through the
 * border/ring these used to sit next to.
 *
 * Allowed: tight black text outlines over card art (`drop-shadow-[0_0_2px_…]`)
 * and 1px `0_0_0_1px` ring shadows — those aren't glows.
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
    return /\.(tsx|ts|css)$/.test(p) && !SKIP.test(p) ? [p] : [];
  });
}

const GLOW_PATTERNS: [string, RegExp][] = [
  ['blurred halo shadow', /\bshadow-\[0_0_(?:[4-9]|\d{2,})px_rgba/],
  ['coloured shadow', /\bshadow-(?:blue|purple|violet|indigo|cyan|sky|pink|fuchsia|emerald|green|amber|yellow|orange|red|teal|rose)-\d{3}\b/],
  ['attention-glow pulse', /attention-glow/],
  ['blur blob', /\bblur-(?:2xl|3xl)\b/],
  ['CSS glow', /box-shadow:\s*0 0 (?:[4-9]|\d{2,})px/],
];

describe('no AI glow styling', () => {
  it('app/ and components/ contain no glow effects', () => {
    const hits: string[] = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const [label, re] of GLOW_PATTERNS) {
          if (re.test(line)) hits.push(`${file}:${i + 1} ${label}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});

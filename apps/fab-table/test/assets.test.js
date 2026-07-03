// Static-asset references in HTML pages must be root-absolute. Pages are
// served at nested paths (/r/<room>, /r/<room>/cam), so a relative src like
// 'zxing-reader.js' resolves to /r/<room>/zxing-reader.js and 404s — which
// broke QR scanning on iPhone Safari (no native BarcodeDetector, so it is
// the only browser that actually loads the zxing fallback).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const isAbsolute = (src) => src.startsWith('/') || /^https?:\/\//.test(src);

for (const file of readdirSync(PUBLIC).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(PUBLIC, file), 'utf8');

  test(`${file}: <script src> paths are root-absolute`, () => {
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      assert.ok(isAbsolute(src), `relative script src "${src}" breaks under /r/<room>/ paths`);
    }
  });

  test(`${file}: loadScript() paths are root-absolute`, () => {
    for (const [, src] of html.matchAll(/loadScript\(\s*['"]([^'"]+)['"]/g)) {
      assert.ok(isAbsolute(src), `relative loadScript("${src}") breaks under /r/<room>/ paths`);
    }
  });

  test(`${file}: wasm locateFile paths are root-absolute`, () => {
    // \w before ".wasm" so the `endsWith('.wasm')` suffix-check literal doesn't match
    for (const [, src] of html.matchAll(/['"]([^'"]*\w\.wasm)['"]/g)) {
      assert.ok(isAbsolute(src), `relative wasm path "${src}" breaks under /r/<room>/ paths`);
    }
  });
}

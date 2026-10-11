// scripts/copy-tesseract-assets.mjs — copy the in-browser text reader's files (tesseract.js worker, its WebAssembly
// core, English language data) from node_modules into public/tesseract/, so /scan serves them itself instead of
// tesseract.js's default public CDN. Runs before `next dev` and `next build` (predev/prebuild); public/tesseract/ is
// gitignored. Versions = the pinned tesseract.js / tesseract.js-core / @tesseract.js-data/eng in package.json.
// Core: the scanner runs the LSTM-only engine, so only the two lstm builds (with and without SIMD) are needed;
// tesseract.js picks between them per browser. Language data: 4.0.0_best_int is the LSTM-only English model.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'public', 'tesseract');
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];
for (const [from, to] of files) {
  const src = path.join(nm, from), dst = path.join(out, to);
  if (!fs.existsSync(src)) { console.error(`copy-tesseract-assets: missing ${src} (run npm install)`); process.exit(1); }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
console.log(`copy-tesseract-assets: ${files.length} files -> public/tesseract/`);

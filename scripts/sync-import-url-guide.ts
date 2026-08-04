// Regenerates lib/deck/import-url-guide.ts from the canonical deck-import-url.md.
// The guide is rendered on /decks/import; the standalone Docker build can't
// read repo-root files at runtime, so the content is bundled as a constant.
// A unit test (lib/deck/import-url-guide.test.ts) pins the two together.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const doc = readFileSync(join(process.cwd(), 'deck-import-url.md'), 'utf8');
const escaped = doc.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

writeFileSync(
  join(process.cwd(), 'lib/deck/import-url-guide.ts'),
  `// GENERATED from deck-import-url.md — do not edit by hand.\n` +
  `// Regenerate with: npx tsx scripts/sync-import-url-guide.ts\n\n` +
  `export const IMPORT_URL_GUIDE = \`${escaped}\`;\n`,
);
console.log('lib/deck/import-url-guide.ts regenerated');

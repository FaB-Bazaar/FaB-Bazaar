// Pins the bundled integration guide (rendered on /decks/import, where the
// standalone build can't fs-read repo files) to the canonical repo doc.
// If deck-import-url.md changes, regenerate the constant:
//   npx tsx scripts/sync-import-url-guide.ts

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IMPORT_URL_GUIDE } from './import-url-guide';

describe('IMPORT_URL_GUIDE', () => {
  test('matches deck-import-url.md exactly (single source of truth)', () => {
    const doc = readFileSync(join(process.cwd(), 'deck-import-url.md'), 'utf8');
    expect(IMPORT_URL_GUIDE).toBe(doc);
  });
});

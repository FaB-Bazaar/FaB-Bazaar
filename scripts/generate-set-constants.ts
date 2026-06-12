/**
 * Regenerate lib/fab-constants/sets-data.generated.ts from the `sets` table.
 *
 * The DB is the SOURCE OF TRUTH for set metadata (migration 0061). The
 * generated module is the client-side snapshot consumed via
 * lib/fab-constants/sets.ts. Run after any change to the sets table:
 *
 *   npx tsx --env-file=.env.local scripts/generate-set-constants.ts
 *
 * The sync invariant test (lib/fab-constants/sets-sync.test.ts) fails until
 * the snapshot matches the table again.
 */

import { writeFileSync } from 'fs';
import path from 'path';
import { PostgresSetsService } from '@/lib/services/postgres/sets/PostgresSetsService';

const OUT_PATH = path.join(__dirname, '..', 'lib', 'fab-constants', 'sets-data.generated.ts');

const q = (s: string) => JSON.stringify(s);

async function main() {
  const service = new PostgresSetsService();
  const res = await service.listSets();
  if (!res.success) throw new Error(`listSets failed: ${res.error}`);
  const rows = res.data; // already ordered by release_order

  if (rows.length < 100) throw new Error(`suspiciously few sets (${rows.length}) — refusing to overwrite snapshot`);

  const mapEntries = rows
    .map((s) => `  ${q(s.code)}: ${q(s.name)},`)
    .join('\n');

  const metaEntries = rows
    .map((s) => {
      const fields = [
        `code: ${q(s.displayCode)}`,
        `name: ${q(s.name)}`,
        `releaseDate: ${q(s.releaseDate ?? '')}`,
        `hasFirstEdition: ${s.hasFirstEdition}`,
        `category: ${q(s.category)}`,
        `tier: ${s.tier}`,
        `displayOrder: ${s.displayOrder}`,
        `unlimitedBeforeFirst: ${s.unlimitedBeforeFirst}`,
      ];
      if (s.defaultRarity) fields.push(`defaultRarity: ${q(s.defaultRarity)}`);
      return `  ${q(s.code)}: { ${fields.join(', ')} },`;
    })
    .join('\n');

  const out = `// lib/fab-constants/sets-data.generated.ts
//
// AUTO-GENERATED from the \`sets\` table by scripts/generate-set-constants.ts
// — DO NOT EDIT BY HAND. The database is the source of truth: update the row
// (or add one for a new set), then regenerate with
//
//   npx tsx --env-file=.env.local scripts/generate-set-constants.ts
//
// Ordered by release_order (global chronological release ordering).

import type { SetMetadata } from './sets';

export const SET_MAP = {
${mapEntries}
} as const;

export const SET_METADATA: Record<string, SetMetadata> = {
${metaEntries}
};
`;

  writeFileSync(OUT_PATH, out);
  console.log(`wrote ${rows.length} sets to ${path.relative(process.cwd(), OUT_PATH)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

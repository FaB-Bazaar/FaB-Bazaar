// lib/scan/dataset-import.test.ts — map fab-cube dataset hash rows onto our printings.
import { describe, it, expect } from 'vitest';
import { planDatasetImport, parseDatasetTsv } from './dataset-import';

const ours = [
  { printingId: 'p1', fabCubePrintingId: 'fc-1', imageUrl: 'https://cf/1' },
  { printingId: 'p2', fabCubePrintingId: 'fc-2', imageUrl: 'https://cf/2' },
  { printingId: 'p3', fabCubePrintingId: null, imageUrl: 'https://cf/3' },     // provisional (CardVault-only)
  { printingId: 'p4', fabCubePrintingId: 'fc-4', imageUrl: null },              // no image
];
const theirs = [
  { uniqueId: 'fc-1', phashFull: '1242923972077909366', phashArt: '3573986783825880892' },
  { uniqueId: 'fc-2', phashFull: '5002121073669724746', phashArt: '' },         // landscape card: no art hash
  { uniqueId: 'fc-9', phashFull: '1', phashArt: '2' },                            // not in our DB
  { uniqueId: 'fc-4', phashFull: '', phashArt: '' },                              // unhashed
];

describe('planDatasetImport', () => {
  it('produces hex hash rows for printings we can anchor, art null when the dataset has none', () => {
    const plan = planDatasetImport(theirs, ours);
    expect(plan.rows).toEqual([
      { printingId: 'p1', phash: BigInt('1242923972077909366').toString(16).padStart(16, '0'), dhash: null, artHash: BigInt('3573986783825880892').toString(16).padStart(16, '0'), imageUrl: 'https://cf/1' },
      { printingId: 'p2', phash: BigInt('5002121073669724746').toString(16).padStart(16, '0'), dhash: null, artHash: null, imageUrl: 'https://cf/2' },
    ]);
  });
  it('reports what it could not map: unanchored printings still need a local hash, dataset ids we lack are ignored', () => {
    const plan = planDatasetImport(theirs, ours);
    expect(plan.unanchored).toEqual(['p3']);
    expect(plan.unhashedInDataset).toEqual(['p4']);
    expect(plan.unknownDatasetIds).toBe(1);
  });
});

describe('parseDatasetTsv', () => {
  it('reads the three hash columns and survives quoted fields containing tabs, quotes and newlines', () => {
    const tsv = [
      'Unique ID\tCard Name\tImage Hash Art\tImage Hash Full',
      'fc-1\t"Sink\tBelow"\t123\t456',
      'fc-2\t"Line one\nline two ""quoted"""\t\t789',
      'fc-3\tPlain\t1\t2',
    ].join('\n') + '\n';
    expect(parseDatasetTsv(tsv)).toEqual([
      { uniqueId: 'fc-1', phashArt: '123', phashFull: '456' },
      { uniqueId: 'fc-2', phashArt: '', phashFull: '789' },
      { uniqueId: 'fc-3', phashArt: '1', phashFull: '2' },
    ]);
  });
});

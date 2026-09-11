// lib/scan/phash-exact.test.ts — bit-exact port of the fab-cube dataset's pHash
// (helper-scripts/calculate-phashes/README.md in IAmThermite/flesh-and-blood-cards).
// Oracle values below were produced by his Python on these exact PNG pixels.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { exactPHash, FULL_BBOX, ART_BBOX, decimalToHex, hexToDecimal } from './phash-exact';

const FIX = path.join(__dirname, '__fixtures__');
const ORACLE = {
  'WTR001-UL': { art: '3573986783825880892', full: '1242923972077909366' },
  'WTR215-UL': { art: '5009478821272755258', full: '4922071216367404863' },
} as const;

async function rgb(file: string) {
  const { data, info } = await sharp(path.join(FIX, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

describe('exactPHash (dataset parity)', () => {
  it.each(Object.keys(ORACLE) as Array<keyof typeof ORACLE>)('%s: art + full hashes equal the Python oracle bit for bit', async (id) => {
    const img = await rgb(`${id}.png`);
    expect(exactPHash(img, ART_BBOX)).toBe(ORACLE[id].art);
    expect(exactPHash(img, FULL_BBOX)).toBe(ORACLE[id].full);
  });
  it('is a 63-bit value with a leading zero bit (fits a signed bigint)', async () => {
    const v = BigInt(exactPHash(await rgb('WTR001-UL.png'), FULL_BBOX));
    expect(v < (BigInt(1) << BigInt(63))).toBe(true);
  });
  it('uses the documented crop boxes', () => {
    expect(ART_BBOX).toEqual({ x: 0.10, y: 0.16, w: 0.80, h: 0.42 });
    expect(FULL_BBOX).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('decimal ↔ hex (our index stores 16-char hex)', () => {
  it('round-trips and pads', () => {
    expect(decimalToHex('1242923972077909366')).toMatch(/^[0-9a-f]{16}$/);
    expect(hexToDecimal(decimalToHex('1242923972077909366'))).toBe('1242923972077909366');
    expect(decimalToHex('0')).toBe('0'.repeat(16));
  });
});

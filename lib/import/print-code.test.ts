import { describe, it, expect } from 'vitest';
import {
  parsePrintCode,
  printCodeFromImageUrl,
  pickPrintingForCode,
  parsePrintCodeCsv,
  formatPrintCodeCatalogCsv,
  type PrintCodeCandidate,
} from './print-code';

describe('parsePrintCode', () => {
  it('reads a plain English code as non-foil, no edition token', () => {
    expect(parsePrintCode('ARC159')).toEqual({
      language: 'en', collector: 'ARC159', foiling: null, edition: null,
      artVariations: [], back: false, marvel: false, unknownTokens: [],
    });
  });

  it('reads our foiling + edition suffixes in any order', () => {
    const a = parsePrintCode('ARC159-RF-1E');
    const b = parsePrintCode('ARC159-1E-RF');
    expect(a).toEqual(b);
    expect(a.foiling).toBe('r');
    expect(a.edition).toBe('f');
  });

  it('reads a language prefix and collapses repeated art tokens', () => {
    const p = parsePrintCode('JA_DYN000-CF-EA-AA-EA');
    expect(p.language).toBe('ja');
    expect(p.collector).toBe('DYN000');
    expect(p.foiling).toBe('c');
    expect(p.artVariations).toEqual(['AA', 'EA']);
  });

  it('reads the CardVault U- unlimited prefix', () => {
    const p = parsePrintCode('U-ARC029-RF');
    expect(p.edition).toBe('u');
    expect(p.collector).toBe('ARC029');
    expect(p.foiling).toBe('r');
  });

  it('reads a CardVault marvel back face', () => {
    const p = parsePrintCode('FR_IAR106-MV_BACK');
    expect(p).toMatchObject({ language: 'fr', collector: 'IAR106', marvel: true, back: true });
  });

  it('maps CardVault JP to ja and is case-insensitive', () => {
    expect(parsePrintCode('jp_ros076-rf')).toMatchObject({ language: 'ja', collector: 'ROS076', foiling: 'r' });
  });

  it('keeps unknown suffix tokens so the matcher can refuse to guess', () => {
    expect(parsePrintCode('IAR001-MVJ').unknownTokens).toEqual(['MVJ']);
  });
});

describe('printCodeFromImageUrl', () => {
  it('takes the Cloudflare image id', () => {
    expect(printCodeFromImageUrl('https://imagedelivery.net/abc/ARC159-RF-1E/public')).toBe('ARC159-RF-1E');
  });
  it('takes the LSS file name for CardVault-hosted images', () => {
    expect(printCodeFromImageUrl(
      'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/IAR187-RF.webp',
    )).toBe('IAR187-RF');
  });
  it('returns null for no url', () => {
    expect(printCodeFromImageUrl(null)).toBeNull();
  });
});

const row = (over: Partial<PrintCodeCandidate>): PrintCodeCandidate => ({
  printing_id: over.printing_id ?? Math.random().toString(36).slice(2),
  name: 'Command and Conquer',
  collector_number: 'ARC159',
  language: 'en',
  foiling: 's',
  edition: 'u',
  art_variations: [],
  is_extended_art: false,
  is_front_face: true,
  ...over,
});

describe('pickPrintingForCode', () => {
  const arc = [
    row({ printing_id: 'u-s', edition: 'u', foiling: 's' }),
    row({ printing_id: 'u-r', edition: 'u', foiling: 'r' }),
    row({ printing_id: 'f-s', edition: 'f', foiling: 's' }),
    row({ printing_id: 'f-r', edition: 'f', foiling: 'r' }),
  ];

  it('picks the exact foiling + edition', () => {
    expect(pickPrintingForCode(parsePrintCode('ARC159-RF-UL'), arc)).toEqual({ status: 'ok', printingId: 'u-r' });
  });

  it('treats an edition-less code on a 1st/Unlimited set as 1st edition (CardVault convention)', () => {
    expect(pickPrintingForCode(parsePrintCode('ARC159'), arc)).toEqual({ status: 'ok', printingId: 'f-s' });
  });

  it('reads U- as Unlimited', () => {
    expect(pickPrintingForCode(parsePrintCode('U-ARC159-RF'), arc)).toEqual({ status: 'ok', printingId: 'u-r' });
  });

  it('matches language and face', () => {
    const rows = [
      row({ printing_id: 'en', collector_number: 'IAR106', edition: 'n' }),
      row({ printing_id: 'fr', collector_number: 'IAR106', edition: 'n', language: 'fr' }),
      row({ printing_id: 'fr-back', collector_number: 'IAR106', edition: 'n', language: 'fr', is_front_face: false }),
    ];
    expect(pickPrintingForCode(parsePrintCode('FR_IAR106'), rows)).toEqual({ status: 'ok', printingId: 'fr' });
    expect(pickPrintingForCode(parsePrintCode('FR_IAR106_BACK'), rows)).toEqual({ status: 'ok', printingId: 'fr-back' });
  });

  it('reads a CardVault marvel as the full-art printing whatever its foiling', () => {
    const rows = [
      row({ printing_id: 'plain', collector_number: 'OBK001', edition: 'n' }),
      row({ printing_id: 'mv', collector_number: 'OBK001', edition: 'n', foiling: 'c', is_extended_art: true, art_variations: ['FA'] }),
    ];
    expect(pickPrintingForCode(parsePrintCode('JA_OBK001-MV'), rows.map(r => ({ ...r, language: 'ja' }))))
      .toEqual({ status: 'ok', printingId: 'mv' });
  });

  it('prefers the printing without art variations when the code names none', () => {
    const rows = [
      row({ printing_id: 'reg', collector_number: 'HNT260', edition: 'n' }),
      row({ printing_id: 'aa', collector_number: 'HNT260', edition: 'n', art_variations: ['AA'] }),
    ];
    expect(pickPrintingForCode(parsePrintCode('HNT260'), rows)).toEqual({ status: 'ok', printingId: 'reg' });
    expect(pickPrintingForCode(parsePrintCode('HNT260-AA'), rows)).toEqual({ status: 'ok', printingId: 'aa' });
  });

  it('is ambiguous when two printings fit equally', () => {
    const rows = [
      row({ printing_id: 'a', collector_number: 'APS013', edition: 'n' }),
      row({ printing_id: 'b', collector_number: 'APS013', edition: 'n' }),
    ];
    expect(pickPrintingForCode(parsePrintCode('APS013'), rows)).toMatchObject({ status: 'ambiguous' });
  });

  it('is not_found when nothing fits', () => {
    expect(pickPrintingForCode(parsePrintCode('ARC159-GF'), arc)).toEqual({ status: 'not_found' });
    expect(pickPrintingForCode(parsePrintCode('ZZZ999'), [])).toEqual({ status: 'not_found' });
  });

  it('refuses to guess past an unknown token unless only one printing exists', () => {
    expect(pickPrintingForCode(parsePrintCode('ARC159-XX'), arc)).toMatchObject({ status: 'ambiguous' });
  });
});

describe('parsePrintCodeCsv', () => {
  it('reads the contract columns, case-insensitive, any order', () => {
    const csv = [
      'Quantity,PRINT_CODE,name,condition,for_trade,wants_quantity',
      '3,ARC159-RF-1E,Command and Conquer,lp,yes,0',
      '0,"JA_HNT260-AA","Command and Conquer",,,2',
    ].join('\n');
    const { rows, errors } = parsePrintCodeCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, printCode: 'ARC159-RF-1E', name: 'Command and Conquer', quantity: 3, condition: 'LP', forTrade: true, wantsQuantity: 0 },
      { line: 3, printCode: 'JA_HNT260-AA', name: 'Command and Conquer', quantity: 0, condition: 'NM', forTrade: false, wantsQuantity: 2 },
    ]);
  });

  it('requires a print_code column', () => {
    expect(parsePrintCodeCsv('name,quantity\nPummel,1').errors[0]).toMatch(/print_code/);
  });

  it('defaults quantity to 1 when the column is absent', () => {
    expect(parsePrintCodeCsv('print_code\nWTR001').rows[0]).toMatchObject({ quantity: 1, wantsQuantity: 0 });
  });

  it('skips rows with nothing to add and reports bad values', () => {
    const { rows, errors } = parsePrintCodeCsv([
      'print_code,quantity,condition',
      'WTR001,0,NM',
      ',2,NM',
      'WTR002,abc,NM',
      'WTR003,1,MINT',
    ].join('\n'));
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(errors.join(' ')).toMatch(/Row 3/);
    expect(errors.join(' ')).toMatch(/Row 4/);
    expect(errors.join(' ')).toMatch(/Row 5/);
  });

  it('rejects codes that are not letters/digits/_/- or are too long', () => {
    const { rows, errors } = parsePrintCodeCsv([
      'print_code,quantity',
      "x'); DROP TABLE printings; --,1",
      `${'A'.repeat(65)},1`,
      'ARC159 RF,1',
      `${'A'.repeat(64)},1`,
    ].join('\n'));
    expect(rows.map(r => r.printCode)).toEqual(['A'.repeat(64)]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/Row 2: print_code isn't a valid code/);
  });

  it('keeps long junk out of the error message', () => {
    const { errors } = parsePrintCodeCsv(`print_code,quantity\n${'A'.repeat(5000)},1`);
    expect(errors[0].length).toBeLessThan(120);
  });

  it('strips a UTF-8 BOM (Excel exports)', () => {
    expect(parsePrintCodeCsv('﻿print_code,quantity\nWTR001,1').rows).toHaveLength(1);
  });

  it('caps the row count', () => {
    const lines = ['print_code,quantity', ...Array.from({ length: 5001 }, () => 'WTR001,1')];
    expect(parsePrintCodeCsv(lines.join('\n')).errors[0]).toMatch(/5,000/);
  });
});

describe('formatPrintCodeCatalogCsv', () => {
  it('writes the header and quotes fields that need it', () => {
    const csv = formatPrintCodeCatalogCsv([{
      print_code: 'ARC159-RF-1E', printing_id: 'NRmnjWwPpMdddDjtKjpRQ', name: 'Command and Conquer',
      pitch: 1, set: 'arc', collector_number: 'ARC159', language: 'en', foiling: 'r', edition: 'f',
      art_variations: [], rarity: 'm',
    }, {
      print_code: 'WTR001', printing_id: 'x', name: 'Rhinar, "Reckless" Rampage',
      pitch: null, set: 'wtr', collector_number: 'WTR001', language: 'en', foiling: 's', edition: 'a',
      art_variations: ['AA', 'EA'], rarity: 't',
    }]);
    expect(csv.split('\n')).toEqual([
      'print_code,name,pitch,set,collector_number,language,foiling,edition,art_variations,rarity,printing_id',
      'ARC159-RF-1E,Command and Conquer,1,arc,ARC159,en,r,f,,m,NRmnjWwPpMdddDjtKjpRQ',
      'WTR001,"Rhinar, ""Reckless"" Rampage",,wtr,WTR001,en,s,a,AA EA,t,x',
      '',
    ]);
  });
});

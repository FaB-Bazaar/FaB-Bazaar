import { describe, it, expect } from 'vitest';
import { assemblePrintCodeImport, namesMatch } from './print-code-import';
import type { PrintCodeCsvRow } from './print-code';
import type { PrintCodeResolution, PrintingDTO } from '@/lib/services/contracts/IPrintingsService';

const printing = (over: Partial<PrintingDTO> = {}) =>
  ({ printing_id: 'p1', name: 'Command and Conquer', ...over }) as PrintingDTO;

const csvRow = (over: Partial<PrintCodeCsvRow> = {}): PrintCodeCsvRow => ({
  line: 2, printCode: 'ARC159-RF-1E', name: '', quantity: 1, condition: 'NM', forTrade: false, wantsQuantity: 0, ...over,
});

describe('namesMatch', () => {
  it('ignores case, spacing and a pitch suffix', () => {
    expect(namesMatch('command and conquer (Red)', printing())).toBe(true);
    expect(namesMatch('  Command  and Conquer ', printing())).toBe(true);
    expect(namesMatch('Command and Conquer - red', printing())).toBe(true);
  });
  it('ignores accents', () => {
    expect(namesMatch('Pokhé', printing({ name: 'Pokhe' }))).toBe(true);
  });
  it('rejects a different card', () => {
    expect(namesMatch('Pummel', printing())).toBe(false);
  });
});

describe('assemblePrintCodeImport', () => {
  it('passes resolved rows through as ok with their quantities', () => {
    const res: PrintCodeResolution[] = [{ code: 'ARC159-RF-1E', status: 'ok', printing: printing() }];
    const out = assemblePrintCodeImport([csvRow({ quantity: 3, condition: 'LP', forTrade: true, wantsQuantity: 1 })], res);
    expect(out).toEqual([{
      line: 2, printCode: 'ARC159-RF-1E', name: '', status: 'ok', printing: printing(),
      quantity: 3, condition: 'LP', forTrade: true, wantsQuantity: 1,
    }]);
  });

  it('flags a code that resolves to a differently named card as not_sure', () => {
    const res: PrintCodeResolution[] = [{ code: 'ARC159-RF-1E', status: 'ok', printing: printing() }];
    const [r] = assemblePrintCodeImport([csvRow({ name: 'Pummel' })], res);
    expect(r.status).toBe('not_sure');
    expect(r.reason).toMatch(/Command and Conquer/);
    expect(r.printing).toEqual(printing());
  });

  it('flags an ambiguous code as not_sure and keeps the candidates', () => {
    const a = printing({ printing_id: 'a' });
    const b = printing({ printing_id: 'b' });
    const [r] = assemblePrintCodeImport([csvRow()], [{ code: 'ARC159-RF-1E', status: 'ambiguous', candidates: [a, b] }]);
    expect(r.status).toBe('not_sure');
    expect(r.candidates).toEqual([a, b]);
    expect(r.printing).toEqual(a);
  });

  it('narrows ambiguous candidates by name when that settles it', () => {
    const a = printing({ printing_id: 'a', name: 'Kassai' });
    const b = printing({ printing_id: 'b', name: 'Tuffnut' });
    const [r] = assemblePrintCodeImport([csvRow({ name: 'Tuffnut' })], [{ code: 'ARC159-RF-1E', status: 'ambiguous', candidates: [a, b] }]);
    expect(r.status).toBe('ok');
    expect(r.printing).toEqual(b);
  });

  it('marks not_found codes unresolved', () => {
    const [r] = assemblePrintCodeImport([csvRow({ printCode: 'ZZZ999' })], [{ code: 'ZZZ999', status: 'not_found' }]);
    expect(r).toMatchObject({ status: 'unresolved', printCode: 'ZZZ999' });
    expect(r.printing).toBeUndefined();
  });
});

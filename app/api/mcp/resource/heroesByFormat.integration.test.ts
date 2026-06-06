import { describe, it, expect } from 'vitest';
import { printingsService } from '@/lib/services';
import { groupHeroesByFormat } from './heroesByFormat';

// Hits the real local Docker DB via the service layer (POSTGRES_URL from .env.local).
// Proves the live listHeroCards → groupHeroesByFormat seam the unit tests mock out.
describe('heroes-by-format (real DB)', () => {
  it('buckets young Oldhim into silver_age and adult Oldhim into ll', async () => {
    const result = await printingsService.listHeroCards();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const grouped = groupHeroesByFormat(result.data);

    const saYoung = grouped.silver_age.young.map(h => h.name);
    const llAdult = grouped.ll.adult.map(h => h.name);

    // Young Oldhim is Silver Age legal; adult "Oldhim, Grandfather of Eternity" is LL.
    expect(saYoung).toContain('oldhim');
    expect(llAdult).toContain('oldhim, grandfather of eternity');

    // Silver Age young pool is sizeable (db-expert counted ~63 at time of writing).
    expect(grouped.silver_age.young.length).toBeGreaterThan(40);
    // Silver Age has no adult heroes.
    expect(grouped.silver_age.adult.length).toBe(0);

    console.log('format counts:', Object.fromEntries(
      Object.entries(grouped).map(([k, v]) => [k, { adult: v.adult.length, young: v.young.length }])
    ));
  });
});

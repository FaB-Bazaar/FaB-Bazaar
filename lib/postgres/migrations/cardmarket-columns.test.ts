/**
 * Pins migration 0126 (Cardmarket prices).
 *
 * printings.cardmarket_* hold the Cardmarket (EUR) product + prices written
 * nightly by pipeline step 012 (cardmarket_prices.py). Every column is
 * nullable: ~3% of printings have no Cardmarket product. 005's upsert never
 * lists them, so the nightly printings upsert can't clobber them.
 *
 * users.cardmarket_prices = the viewer wants Cardmarket € instead of
 * TCGplayer $ everywhere (default off).
 *
 * Runs against the local DB (POSTGRES_URL via vitest.setup.ts) — red until
 * 0126 is applied.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

let pool: Pool;
beforeAll(() => {
  pool = new Pool({ connectionString: process.env.POSTGRES_URL });
});
afterAll(async () => {
  await pool.end();
});

type Col = { type: string; nullable: boolean; default: string | null };

async function columns(table: string): Promise<Record<string, Col>> {
  const r = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return Object.fromEntries(
    r.rows.map((x) => [x.column_name, { type: x.data_type, nullable: x.is_nullable === 'YES', default: x.column_default }]),
  );
}

describe('migration 0126: Cardmarket prices', () => {
  it('printings has the cardmarket_* columns, all nullable', async () => {
    const cols = await columns('printings');
    expect(cols.cardmarket_product_id).toMatchObject({ type: 'integer', nullable: true });
    for (const c of ['cardmarket_trend', 'cardmarket_low', 'cardmarket_avg7', 'cardmarket_avg30']) {
      expect(cols[c], c).toMatchObject({ type: 'numeric', nullable: true });
    }
    expect(cols.cardmarket_url).toMatchObject({ type: 'text', nullable: true });
    expect(cols.cardmarket_match_status).toMatchObject({ type: 'text', nullable: true });
    expect(cols.cardmarket_price_updated_at).toMatchObject({ type: 'timestamp with time zone', nullable: true });
  });

  it('cardmarket_match_status only accepts matched / review', async () => {
    const r = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'printings'::regclass AND conname = 'printings_cardmarket_match_status_check'`,
    );
    expect(r.rows[0]?.def).toContain("'matched'");
    expect(r.rows[0]?.def).toContain("'review'");
  });

  it('users.cardmarket_prices is a non-null boolean defaulting to false', async () => {
    const cols = await columns('users');
    expect(cols.cardmarket_prices).toEqual({ type: 'boolean', nullable: false, default: 'false' });
  });
});

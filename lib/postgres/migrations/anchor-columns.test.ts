/**
 * Pins migration 0088 (source-anchor columns for the dual-source ID model).
 *
 * printing_id / card_unique_id are OUR immutable internal PKs; the anchor
 * columns record which upstream source a row is reconciled to:
 *   - fab_cube_printing_id / fab_cube_card_id — fab-cube feed anchor.
 *     NULL = provisional (pipeline must not prune; adoption pending).
 *   - lss_print_id — CardVault print UUID (ingest idempotency key).
 *   - lss_print_code — CardVault human print code (debug convenience).
 *
 * Runs against the local DB (POSTGRES_URL via vitest.setup.ts) — red until
 * 0088 is applied.
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

async function columns(table: string): Promise<Record<string, { nullable: boolean }>> {
  const r = await pool.query(
    `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return Object.fromEntries(r.rows.map((x) => [x.column_name, { nullable: x.is_nullable === 'YES' }]));
}

describe('migration 0088: source-anchor columns', () => {
  it('printings has the three anchor columns, all nullable', async () => {
    const cols = await columns('printings');
    expect(cols.fab_cube_printing_id).toEqual({ nullable: true });
    expect(cols.lss_print_id).toEqual({ nullable: true });
    expect(cols.lss_print_code).toEqual({ nullable: true });
  });

  it('cards has fab_cube_card_id, nullable', async () => {
    const cols = await columns('cards');
    expect(cols.fab_cube_card_id).toEqual({ nullable: true });
  });

  it('anchor columns have partial unique indexes (NULLs exempt)', async () => {
    const r = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('printings','cards')`,
    );
    const defs = r.rows.map((x) => x.indexdef as string);
    const partialUnique = (col: string) =>
      defs.some((d) => d.startsWith('CREATE UNIQUE INDEX') && d.includes(`(${col})`) && d.includes(`${col} IS NOT NULL`));
    expect(partialUnique('fab_cube_printing_id')).toBe(true);
    expect(partialUnique('lss_print_id')).toBe(true);
    expect(partialUnique('fab_cube_card_id')).toBe(true);
  });

  it('backfill: every English printing is anchored to its own id; non-English stays NULL', async () => {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE language = 'en' AND fab_cube_printing_id IS DISTINCT FROM printing_id) AS en_unanchored,
        COUNT(*) FILTER (WHERE language != 'en' AND fab_cube_printing_id IS NOT NULL) AS non_en_anchored
      FROM printings`);
    expect(Number(r.rows[0].en_unanchored)).toBe(0);
    expect(Number(r.rows[0].non_en_anchored)).toBe(0);
  });

  it('backfill: every card is anchored to its own card_unique_id', async () => {
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM cards WHERE fab_cube_card_id IS DISTINCT FROM card_unique_id`,
    );
    expect(Number(r.rows[0].n)).toBe(0);
  });
});

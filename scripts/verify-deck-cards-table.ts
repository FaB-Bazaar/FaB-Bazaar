import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function verify() {
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');

  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'deck_cards'
    ORDER BY ordinal_position;
  `);

  console.log('deck_cards table columns:');
  console.table(result.rows);
}

verify().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

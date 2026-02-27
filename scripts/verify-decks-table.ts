import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function verify() {
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');

  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'decks'
    ORDER BY ordinal_position;
  `);

  console.log('Decks table columns:');
  console.table(result.rows);

  const deckCount = await db.execute(sql`SELECT COUNT(*) FROM decks;`);
  console.log(`\nTotal decks: ${deckCount.rows[0].count}`);
}

verify().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

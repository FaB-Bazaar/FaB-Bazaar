/**
 * Consolidate duplicate deck_cards rows into single rows with quantities
 *
 * Before: 3 rows with quantity=1 for same card
 * After:  1 row with quantity=3
 *
 * Run with: npx tsx scripts/consolidate-deck-cards.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function consolidateDeckCards() {
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');

  console.log('🔄 Starting deck_cards consolidation...');

  try {
    // Find duplicates (same deck_id, printing_id, category)
    const duplicates = await db.execute(sql`
      SELECT
        deck_id,
        printing_id,
        category,
        COUNT(*) as duplicate_count,
        SUM(quantity) as total_quantity,
        ARRAY_AGG(id) as all_ids
      FROM deck_cards
      GROUP BY deck_id, printing_id, category
      HAVING COUNT(*) > 1;
    `);

    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicates found - database is clean!');
      return;
    }

    console.log(`Found ${duplicates.rows.length} groups of duplicates to consolidate`);

    let totalRowsRemoved = 0;
    let totalRowsUpdated = 0;

    for (const dup of duplicates.rows) {
      const ids = dup.all_ids as string[];
      const keepId = ids[0]; // Keep first row
      const removeIds = ids.slice(1); // Remove others
      const totalQty = dup.total_quantity;

      console.log(`\n  Consolidating: deck=${dup.deck_id.substring(0, 8)}... printing=${dup.printing_id.substring(0, 12)}...`);
      console.log(`    ${ids.length} rows → 1 row (quantity: ${totalQty})`);

      // Update the keeper row with total quantity
      await db.execute(sql`
        UPDATE deck_cards
        SET quantity = ${totalQty}
        WHERE id = ${keepId};
      `);
      totalRowsUpdated++;

      // Delete duplicate rows
      for (const removeId of removeIds) {
        await db.execute(sql`
          DELETE FROM deck_cards WHERE id = ${removeId};
        `);
        totalRowsRemoved++;
      }
    }

    console.log('\n✨ Consolidation complete!');
    console.log(`   ${totalRowsUpdated} rows updated with new quantities`);
    console.log(`   ${totalRowsRemoved} duplicate rows removed`);
    console.log(`   Saved ${totalRowsRemoved} rows of storage!`);

  } catch (error) {
    console.error('❌ Consolidation failed:', error);
    throw error;
  }
}

consolidateDeckCards()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

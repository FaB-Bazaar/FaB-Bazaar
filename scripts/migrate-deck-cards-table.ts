/**
 * Migration script to fix deck_cards table structure
 * - Remove deprecated pitch column
 * - Add missing notes column
 * - Add missing added_at column
 *
 * Run with: npx tsx scripts/migrate-deck-cards-table.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local FIRST
config({ path: resolve(process.cwd(), '.env.local') });

async function migrateDeckCardsTable() {
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');

  console.log('🔄 Starting deck_cards table migration...');

  try {
    // Remove deprecated pitch column (should get it from cards table via JOIN)
    console.log('🗑️  Removing deprecated pitch column...');
    await db.execute(sql`
      ALTER TABLE deck_cards DROP COLUMN IF EXISTS pitch;
    `);
    console.log('✅ Pitch column removed');

    // Add missing columns
    console.log('📝 Adding missing columns...');
    await db.execute(sql`
      ALTER TABLE deck_cards
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS added_at timestamp DEFAULT now() NOT NULL;
    `);
    console.log('✅ Columns added successfully');

    // Update existing rows to have added_at if they don't
    console.log('🔧 Updating existing rows...');
    await db.execute(sql`
      UPDATE deck_cards
      SET added_at = COALESCE(added_at, now())
      WHERE added_at IS NULL;
    `);
    console.log('✅ Existing rows updated');

    console.log('✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateDeckCardsTable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

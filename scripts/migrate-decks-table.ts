/**
 * Migration script to add missing columns to decks table
 * Run with: npx tsx scripts/migrate-decks-table.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local FIRST
config({ path: resolve(process.cwd(), '.env.local') });

async function migrateDecksTable() {
  // Import after env is loaded
  const { db } = await import('@/lib/postgres/db');
  const { sql } = await import('drizzle-orm');
  const { nanoid } = await import('nanoid');

  console.log('🔄 Starting decks table migration...');

  try {
    // Add missing columns to decks table
    console.log('📝 Adding missing columns...');

    await db.execute(sql`
      ALTER TABLE decks
      ADD COLUMN IF NOT EXISTS public_id text,
      ADD COLUMN IF NOT EXISTS slug text,
      ADD COLUMN IF NOT EXISTS hero_name text,
      ADD COLUMN IF NOT EXISTS fabrary_url text,
      ADD COLUMN IF NOT EXISTS fabrary_deck_id text,
      ADD COLUMN IF NOT EXISTS tags text[],
      ADD COLUMN IF NOT EXISTS metadata jsonb;
    `);

    console.log('✅ Columns added successfully');

    // Generate public_id for existing decks
    console.log('🔑 Generating public_ids for existing decks...');

    const decksWithoutPublicId = await db.execute(sql`
      SELECT id FROM decks WHERE public_id IS NULL;
    `);

    if (decksWithoutPublicId.rows.length > 0) {
      console.log(`Found ${decksWithoutPublicId.rows.length} decks without public_id`);

      for (const deck of decksWithoutPublicId.rows) {
        const publicId = nanoid(12);
        await db.execute(sql`
          UPDATE decks SET public_id = ${publicId} WHERE id = ${deck.id};
        `);
      }

      console.log(`✅ Generated public_ids for ${decksWithoutPublicId.rows.length} decks`);
    } else {
      console.log('✅ All decks already have public_ids');
    }

    // Add NOT NULL constraint and unique constraint to public_id
    console.log('🔒 Adding constraints...');

    await db.execute(sql`
      ALTER TABLE decks
      ALTER COLUMN public_id SET NOT NULL;
    `);

    await db.execute(sql`
      ALTER TABLE decks
      ADD CONSTRAINT decks_public_id_unique UNIQUE (public_id);
    `);

    console.log('✅ Constraints added successfully');

    // Create indexes
    console.log('📊 Creating indexes...');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_decks_public_id ON decks (public_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_decks_user_slug ON decks (user_id, slug);
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_decks_user_name ON decks (user_id, name);
    `);

    console.log('✅ Indexes created successfully');

    console.log('✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateDecksTable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

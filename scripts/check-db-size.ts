/**
 * Check PostgreSQL database size and provide scalability analysis
 */

import { db } from '@/lib/postgres/db';
import { sql } from 'drizzle-orm';

async function checkDatabaseSize() {
  try {
    console.log('📊 PostgreSQL Database Size Analysis\n');
    console.log('='.repeat(80));

    // Get total database size
    const dbSize = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size,
             pg_database_size(current_database()) as size_bytes
    `);

    console.log('\n📦 TOTAL DATABASE SIZE');
    console.log(`   ${dbSize.rows[0].total_size} (${Number(dbSize.rows[0].size_bytes).toLocaleString()} bytes)`);

    // Get table sizes
    const tableSizes = await db.execute(sql`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY size_bytes DESC
    `);

    console.log('\n📋 TABLE BREAKDOWN (sorted by size)');
    console.log('─'.repeat(80));
    console.log(
      'Table'.padEnd(25) +
      'Total Size'.padEnd(15) +
      'Table'.padEnd(12) +
      'Indexes'.padEnd(12) +
      'Rows'
    );
    console.log('─'.repeat(80));

    for (const row of tableSizes.rows) {
      // Get row count
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${row.tablename}`));
      const rowCount = Number(countResult.rows[0].count).toLocaleString();

      console.log(
        String(row.tablename).padEnd(25) +
        String(row.total_size).padEnd(15) +
        String(row.table_size).padEnd(12) +
        String(row.indexes_size).padEnd(12) +
        rowCount
      );
    }

    // Get index information
    const indexes = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
      LIMIT 10
    `);

    console.log('\n🔍 TOP 10 LARGEST INDEXES');
    console.log('─'.repeat(80));
    for (const idx of indexes.rows) {
      console.log(`   ${String(idx.indexname).padEnd(50)} ${idx.index_size}`);
    }

    // Calculate per-user statistics
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const totalUsers = Number(userCount.rows[0].count);

    const inventoryCount = await db.execute(sql`SELECT COUNT(*) as count FROM inventory_items`);
    const totalInventory = Number(inventoryCount.rows[0].count);

    const wantsCount = await db.execute(sql`SELECT COUNT(*) as count FROM wants_items`);
    const totalWants = Number(wantsCount.rows[0].count);

    const decksCount = await db.execute(sql`SELECT COUNT(*) as count FROM decks`);
    const totalDecks = Number(decksCount.rows[0].count);

    const deckCardsCount = await db.execute(sql`SELECT COUNT(*) as count FROM deck_cards`);
    const totalDeckCards = Number(deckCardsCount.rows[0].count);

    console.log('\n👥 PER-USER STATISTICS (Average)');
    console.log('─'.repeat(80));
    console.log(`   Total Users: ${totalUsers.toLocaleString()}`);
    console.log(`   Inventory Items per User: ${(totalInventory / totalUsers).toFixed(1)}`);
    console.log(`   Wants Items per User: ${(totalWants / totalUsers).toFixed(1)}`);
    console.log(`   Decks per User: ${(totalDecks / totalUsers).toFixed(1)}`);
    console.log(`   Deck Cards per User: ${(totalDeckCards / totalUsers).toFixed(1)}`);

    const dbSizeBytes = Number(dbSize.rows[0].size_bytes);
    const bytesPerUser = dbSizeBytes / totalUsers;
    console.log(`   Database Size per User: ${(bytesPerUser / 1024 / 1024).toFixed(2)} MB`);

    // Scalability projections
    console.log('\n📈 SCALABILITY PROJECTIONS');
    console.log('─'.repeat(80));

    const projections = [
      { users: 1000, label: '1K users' },
      { users: 10000, label: '10K users' },
      { users: 100000, label: '100K users' },
      { users: 1000000, label: '1M users' },
    ];

    console.log('Users'.padEnd(15) + 'Est. DB Size'.padEnd(20) + 'Est. Inventory'.padEnd(20) + 'Est. Deck Cards');
    console.log('─'.repeat(80));

    for (const proj of projections) {
      const estSize = (bytesPerUser * proj.users / 1024 / 1024 / 1024).toFixed(2);
      const estInventory = Math.round(totalInventory / totalUsers * proj.users);
      const estDeckCards = Math.round(totalDeckCards / totalUsers * proj.users);

      console.log(
        proj.label.padEnd(15) +
        `${estSize} GB`.padEnd(20) +
        estInventory.toLocaleString().padEnd(20) +
        estDeckCards.toLocaleString()
      );
    }

    console.log('\n💡 SCALABILITY NOTES');
    console.log('─'.repeat(80));
    console.log('1. Cards & Printings tables are STATIC (constant size regardless of users)');
    console.log('   - 4,562 unique cards will not grow with users');
    console.log('   - 15,155 printings will only grow with new set releases');
    console.log('');
    console.log('2. User-specific data scales LINEARLY:');
    console.log('   - Inventory Items: ~97 per user');
    console.log('   - Wants Items: ~3 per user');
    console.log('   - Decks: ~0.05 per user (5 decks per 100 users)');
    console.log('   - Deck Cards: ~0.9 per user');
    console.log('');
    console.log('3. Normalized structure benefits:');
    console.log('   - No data duplication (vs MongoDB embedded documents)');
    console.log('   - Efficient indexing on foreign keys');
    console.log('   - Updates to card metadata don\'t require updating user data');
    console.log('');
    console.log('4. Performance optimization strategies:');
    console.log('   - Connection pooling (already using Drizzle)');
    console.log('   - Read replicas for heavy read workloads');
    console.log('   - Partitioning large tables by user_id ranges (100K+ users)');
    console.log('   - Materialized views for complex aggregations');
    console.log('   - Caching layer (Redis) for frequently accessed data');

    console.log('\n='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabaseSize();

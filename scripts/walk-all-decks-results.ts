#!/usr/bin/env npx tsx
/**
 * scripts/walk-all-decks-results.ts
 *
 * Smoke-test the new game-results service methods against every deck in the
 * DB that has tracked games. Verifies the summary shape across real data
 * from every active user — catches anything the integration tests' seeded
 * fixtures might miss.
 *
 *   npx tsx scripts/walk-all-decks-results.ts
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

// Dynamic imports — `@/lib/postgres/db` reads POSTGRES_URL at module load,
// so it must not be imported before loadEnvConfig runs.

interface DeckRow {
  id: string;
  public_id: string;
  name: string;
  username: string;
  games: string;
}

async function main() {
  const { pool } = await import('@/lib/postgres/db');
  const { PostgresGameResultsService } = await import('@/lib/services/postgres/gameResults/PostgresGameResultsService');
  const service = new PostgresGameResultsService();

  const { rows: decks } = await pool.query<DeckRow>(`
    SELECT d.id, d.public_id, d.name, u.username, COUNT(g.id) AS games
    FROM decks d
    JOIN users u ON u.id = d.user_id
    JOIN game_results g ON g.deck_id = d.id
    GROUP BY d.id, d.public_id, d.name, u.username
    ORDER BY COUNT(g.id) DESC
  `);

  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const deck of decks) {
    const summary = await service.getGameResultsForDeck(deck.id, { limit: 50 });
    if (!summary.success) {
      fail++;
      failures.push(`${deck.username}/${deck.name}: summary failed: ${summary.error}`);
      continue;
    }

    let shapeOk = true;
    for (const row of summary.data.data) {
      if ('turnLog' in row || 'opponentTurnLog' in row || 'turnResults' in row) {
        shapeOk = false;
        failures.push(`${deck.username}/${deck.name}/${row.id}: summary leaked a turn field`);
      }
      if (typeof row.imageUrls !== 'object' || row.imageUrls === null) {
        shapeOk = false;
        failures.push(`${deck.username}/${deck.name}/${row.id}: missing imageUrls`);
      }
    }
    if (!shapeOk) { fail++; continue; }

    const firstId = summary.data.data[0]?.id;
    if (firstId) {
      const detail = await service.getGameResult(firstId, deck.id);
      if (!detail.success) {
        fail++;
        failures.push(`${deck.username}/${deck.name}/${firstId}: detail failed: ${detail.error}`);
        continue;
      }
      if (typeof detail.data.imageUrls !== 'object') {
        fail++;
        failures.push(`detail missing imageUrls`);
        continue;
      }
    }

    let totalRefs = 0;
    let resolved = 0;
    for (const row of summary.data.data) {
      for (const cr of (row.cardResults as Array<{ cardId?: string }> | null) ?? []) {
        if (cr.cardId) { totalRefs++; if (row.imageUrls[cr.cardId]) resolved++; }
      }
      for (const cr of (row.opponentCardResults as Array<{ cardId?: string }> | null) ?? []) {
        if (cr.cardId) { totalRefs++; if (row.imageUrls[cr.cardId]) resolved++; }
      }
    }
    pass++;
    const pct = totalRefs > 0 ? Math.round((100 * resolved) / totalRefs) : 100;
    const flag = pct < 95 ? '!!' : 'OK';
    console.log(
      `${flag} ${deck.username.padEnd(35)} ${deck.name.padEnd(28)} games=${String(deck.games).padStart(3)}  resolve=${resolved}/${totalRefs} (${pct}%)`
    );
  }

  console.log(`\n${pass} decks passed, ${fail} failures`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 20)) console.log('  -', f);
  }

  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });

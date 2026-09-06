/**
 * "Future release" predicate shared by the printings search, the hero picker
 * and the deck add-card gate: a card counts as a future release when at least
 * one of its printings belongs to a set whose `release_date` is after today.
 *
 * Sets in the `excluded` category (welcome/demo decks, event tokens) never
 * count. Sets with a NULL release_date (unannounced) never count either — the
 * DB is the source of truth, so a set only enters the Future Classic
 * Constructed pool once its release date is registered in `sets`.
 *
 * Future Classic Constructed = cc_legal OR this predicate, minus the CC banlist
 * and CC suspensions (see PostgresPrintingsService format handling).
 */

import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { printings, sets } from '@/lib/postgres/schema';

/**
 * `<cardUniqueId> IN (SELECT …)` — true when the card has a printing in a
 * future-dated set.
 *
 * Deliberately UNCORRELATED: the inner select has no reference to the outer
 * row, so Postgres evaluates it once and hashes the (tiny) id set, in both
 * WHERE and SELECT-list positions. The correlated `EXISTS (… WHERE fp.card_unique_id = outer)`
 * form re-ran per candidate row inside the groupByCard subquery and took the
 * class/talent-union search from ~0.6s to >5s.
 */
export function isFutureReleaseCard(cardUniqueId: PgColumn | SQL): SQL<boolean> {
  return sql<boolean>`(${cardUniqueId} IN (
    SELECT fp.card_unique_id FROM ${printings} fp
    JOIN ${sets} fs ON fs.code = fp.set
    WHERE fs.release_date > CURRENT_DATE
      AND fs.category <> 'excluded'
  ))`;
}

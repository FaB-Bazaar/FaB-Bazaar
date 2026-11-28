/**
 * "Future release" predicate shared by the printings search, the hero picker
 * and the deck add-card gate: a card counts as a future release when at least
 * one of its printings belongs to a set whose `release_date` is today or later.
 *
 * Release day counts on purpose: a spoiler-season card's `cc_legal` flag is
 * only flipped by the nightly `apply_provisional_legality()` run, so with a
 * strict `>` the set dropped out of every CC deck pool for most of its own
 * release day (MPA, 2026-11-13).
 *
 * Sets in the `excluded` category (welcome/demo decks, event tokens) never
 * count. Sets with a NULL release_date (unannounced) never count either — the
 * DB is the source of truth, so a set's cards only enter the CC deck pool
 * early once its release date is registered in `sets`.
 *
 * A CC deck's pool (the retired Future CC, folded into CC) = cc_legal OR this predicate, minus the CC banlist
 * and CC suspensions (see PostgresPrintingsService format handling).
 */

import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { printings, sets } from '@/lib/postgres/schema';

/**
 * `<cardUniqueId> IN (SELECT …)` — true when the card has a printing in a
 * set releasing today or later.
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
    WHERE fs.release_date >= CURRENT_DATE
      AND fs.category <> 'excluded'
  ))`;
}

/**
 * Silver Age takes spoiler-season cards too (owner call 2026-11-28; young OBK
 * heroes before 2027-02-12): a future-release card that WOULD be Silver Age
 * legal — ever printed at common / rare / basic / token (TRP 7.4: "a card is a
 * common card for silver age if it has ever been printed with basic- or
 * common-rarity") and not an adult hero. Bans and benches still apply on top.
 *
 * Both subqueries are uncorrelated, like isFutureReleaseCard, so Postgres
 * hashes each id set once instead of re-running per candidate row.
 */
export function isFutureSilverAgeCard(cardUniqueId: PgColumn | SQL, types: PgColumn | SQL): SQL<boolean> {
  return sql<boolean>`(${isFutureReleaseCard(cardUniqueId)}
    AND ${cardUniqueId} IN (
      SELECT lp.card_unique_id FROM ${printings} lp
      WHERE lower(lp.rarity) IN ('c', 'r', 'b', 't')
    )
    AND NOT ('hero' = ANY(${types}) AND NOT ('young' = ANY(${types}))))`;
}

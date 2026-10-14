/**
 * SQL rarity rank per RARITY_SORT_ORDER (Promo → Fabled → Marvel → Legendary →
 * Majestic → Super Rare → Rare → Common → Basic → Token); unknown codes last.
 * Shared by the printings search ('rarity' sort) and the binder 'rarity' sort.
 */

import { sql, type SQL } from 'drizzle-orm';
import { RARITY_SORT_ORDER } from '@/lib/fab-constants/rarities';

export function rarityRank(col: unknown): SQL {
  const whens = RARITY_SORT_ORDER.map((code, i) => sql`WHEN ${code} THEN ${sql.raw(String(i))}`);
  return sql`CASE ${col} ${sql.join(whens, sql` `)} ELSE ${sql.raw(String(RARITY_SORT_ORDER.length))} END`;
}

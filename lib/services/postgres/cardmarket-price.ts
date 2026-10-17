import { sql } from 'drizzle-orm';
import { printings } from '@/lib/postgres/schema';

/**
 * THE Cardmarket (EUR) price of a printing, for users.cardmarket_prices viewers:
 * the price-guide trend, else the cheapest listing. NULL = no Cardmarket price —
 * never fall back to a TCGplayer $ price (one source per screen).
 */
export const cardmarketPriceSql = sql<number | null>`COALESCE(${printings.cardmarketTrend}, ${printings.cardmarketLow})::float`;

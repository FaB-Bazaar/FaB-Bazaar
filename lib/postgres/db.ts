/**
 * PostgreSQL Connection for FaB Bazaar
 *
 * Uses Drizzle ORM with node-postgres (pg)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Ensure POSTGRES_URL is set
if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set. Please add it to your .env.local file.');
}

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 20,  // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export pool for direct access if needed
export { pool };

// Graceful shutdown (guarded to prevent listener leak during hot reload)
if (!(globalThis as any).__pgShutdownRegistered) {
  process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
  });

  (globalThis as any).__pgShutdownRegistered = true;
}

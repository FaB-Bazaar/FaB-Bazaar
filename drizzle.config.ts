import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

export default {
  schema: './lib/postgres/schema.ts',
  out: './lib/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? (() => {
      throw new Error('POSTGRES_URL environment variable must be set');
    })(),
  },
} satisfies Config;

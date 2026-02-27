/**
 * Create OAuth tables migration
 * Run with: tsx scripts/create-oauth-tables.ts
 */

import { db } from '@/lib/postgres/db';
import { sql } from 'drizzle-orm';

async function createOAuthTables() {
  console.log('Creating OAuth tables...');

  try {
    // Create oauth_clients table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL UNIQUE,
        client_secret TEXT NOT NULL,
        client_name TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        username TEXT,
        redirect_uris TEXT[] DEFAULT '{}' NOT NULL,
        grant_types TEXT[] DEFAULT '{client_credentials}' NOT NULL,
        response_types TEXT[] DEFAULT '{token}' NOT NULL,
        token_endpoint_auth_method TEXT DEFAULT 'client_secret_basic' NOT NULL,
        scope TEXT DEFAULT 'read write' NOT NULL,
        client_uri TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        client_id_issued_at INTEGER NOT NULL,
        last_used TIMESTAMP
      );
    `);
    console.log('✅ Created oauth_clients table');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_clients_user_id ON oauth_clients(user_id);`);
    console.log('✅ Created oauth_clients indexes');

    // Create oauth_authorization_codes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT NOT NULL,
        code_challenge TEXT,
        code_challenge_method TEXT,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Created oauth_authorization_codes table');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_codes_code ON oauth_authorization_codes(code);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_codes_client_id ON oauth_authorization_codes(client_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_codes_user_id ON oauth_authorization_codes(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);`);
    console.log('✅ Created oauth_authorization_codes indexes');

    // Create oauth_access_tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL UNIQUE,
        token_type TEXT DEFAULT 'bearer' NOT NULL,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        refresh_token TEXT UNIQUE,
        refresh_token_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Created oauth_access_tokens table');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_tokens_access_token ON oauth_access_tokens(access_token);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh_token ON oauth_access_tokens(refresh_token);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_id ON oauth_access_tokens(client_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_access_tokens(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_access_tokens(expires_at);`);
    console.log('✅ Created oauth_access_tokens indexes');

    console.log('\n🎉 All OAuth tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating OAuth tables:', error);
    process.exit(1);
  }
}

createOAuthTables();

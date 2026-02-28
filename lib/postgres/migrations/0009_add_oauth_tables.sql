CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL UNIQUE,
	"client_secret" text NOT NULL,
	"client_name" text NOT NULL,
	"user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
	"username" text,
	"redirect_uris" text[] NOT NULL DEFAULT '{}',
	"grant_types" text[] NOT NULL DEFAULT '{client_credentials}',
	"response_types" text[] NOT NULL DEFAULT '{token}',
	"token_endpoint_auth_method" text NOT NULL DEFAULT 'client_secret_basic',
	"scope" text NOT NULL DEFAULT 'read write',
	"client_uri" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"client_id_issued_at" integer NOT NULL,
	"last_used" timestamp
);

CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL UNIQUE,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"expires_at" timestamp NOT NULL,
	"used" boolean NOT NULL DEFAULT false,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL UNIQUE,
	"token_type" text NOT NULL DEFAULT 'bearer',
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refresh_token" text UNIQUE,
	"refresh_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_oauth_clients_client_id" ON "oauth_clients"("client_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_clients_user_id" ON "oauth_clients"("user_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_codes_code" ON "oauth_authorization_codes"("code");
CREATE INDEX IF NOT EXISTS "idx_oauth_codes_client_id" ON "oauth_authorization_codes"("client_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_codes_user_id" ON "oauth_authorization_codes"("user_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_codes_expires_at" ON "oauth_authorization_codes"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_oauth_tokens_access_token" ON "oauth_access_tokens"("access_token");
CREATE INDEX IF NOT EXISTS "idx_oauth_tokens_refresh_token" ON "oauth_access_tokens"("refresh_token");
CREATE INDEX IF NOT EXISTS "idx_oauth_tokens_client_id" ON "oauth_access_tokens"("client_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_tokens_user_id" ON "oauth_access_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "idx_oauth_tokens_expires_at" ON "oauth_access_tokens"("expires_at");

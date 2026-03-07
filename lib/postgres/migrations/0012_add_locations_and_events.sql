-- Migration: Add locations, events, and related tables
-- PKs are TEXT (app-generated nanoids), matching existing schema pattern

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE location_category AS ENUM ('store', 'venue');

CREATE TYPE event_type AS ENUM (
  'calling', 'pro_tour', 'national', 'open', 'store_champ', 'other'
);

CREATE TYPE submission_status AS ENUM (
  'pending', 'approved', 'rejected', 'needs_review'
);

CREATE TYPE submitter_relationship AS ENUM (
  'owner', 'manager', 'employee', 'customer', 'other'
);

-- ============================================================================
-- GEO REFERENCE TABLES (populated by 0013_seed_countries_states.sql)
-- ============================================================================

CREATE TABLE countries (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  iso2       TEXT NOT NULL UNIQUE,
  iso3       TEXT,
  phone_code TEXT
);

CREATE TABLE states (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  country_id  INTEGER NOT NULL REFERENCES countries(id),
  UNIQUE (state_code, country_id)
);

-- ============================================================================
-- LOCATIONS
-- ============================================================================

CREATE TABLE locations (
  id                       TEXT PRIMARY KEY,
  category                 location_category NOT NULL DEFAULT 'store',
  name                     TEXT NOT NULL,

  -- Address
  address_line1            TEXT NOT NULL,
  address_city             TEXT NOT NULL,
  address_state            TEXT,
  address_postal_code      TEXT,
  address_country          TEXT NOT NULL,
  address_country_id       INTEGER REFERENCES countries(id),
  address_state_id         INTEGER REFERENCES states(id),

  -- Contact (emails encrypted AES-256-CBC)
  contact_phone            TEXT,
  contact_email            TEXT,
  contact_email_iv         TEXT,
  contact_website          TEXT,

  -- External IDs
  tcgplayer_id             TEXT,
  google_place_id          TEXT,
  facebook_id              TEXT,
  tcgplayer_storefront_url TEXT,
  discord_invite_url       TEXT,

  -- Meta
  tags                     TEXT[] NOT NULL DEFAULT '{}',
  active                   BOOLEAN NOT NULL DEFAULT true,
  geo_lat                  TEXT,
  geo_lng                  TEXT,
  images                   TEXT[] NOT NULL DEFAULT '{}',

  -- Manager contact (email encrypted)
  manager_name             TEXT,
  manager_email            TEXT,
  manager_email_iv         TEXT,
  manager_phone            TEXT,

  notes                    TEXT,
  follower_count           INTEGER NOT NULL DEFAULT 0,

  created_at               TIMESTAMP NOT NULL DEFAULT now(),
  updated_at               TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_category   ON locations (category);
CREATE INDEX idx_locations_country    ON locations (address_country);
CREATE INDEX idx_locations_state      ON locations (address_state);
CREATE INDEX idx_locations_country_id ON locations (address_country_id);
CREATE INDEX idx_locations_state_id   ON locations (address_state_id);
CREATE INDEX idx_locations_active     ON locations (active);
CREATE INDEX idx_locations_fts ON locations USING gin(to_tsvector('english'::regconfig, name));
CREATE INDEX idx_locations_tags ON locations USING gin(tags);

-- ============================================================================
-- EVENTS
-- ============================================================================

CREATE TABLE events (
  id                  TEXT PRIMARY KEY,
  location_id         TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  type                event_type NOT NULL DEFAULT 'other',
  format              TEXT,
  start_date          TIMESTAMP NOT NULL,
  end_date            TIMESTAMP NOT NULL,
  registration_url    TEXT,
  discord_invite_url  TEXT,
  notes               TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_location_id ON events (location_id);
CREATE INDEX idx_events_dates       ON events (start_date, end_date);
CREATE INDEX idx_events_type        ON events (type);
CREATE INDEX idx_events_active_start ON events (active, start_date);

-- ============================================================================
-- EVENT ATTENDANCE
-- ============================================================================

CREATE TABLE event_attendance (
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bringing_trades BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_attendance_user_id ON event_attendance (user_id);

-- ============================================================================
-- USER FOLLOWED STORES
-- ============================================================================

CREATE TABLE user_followed_stores (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  followed_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

CREATE INDEX idx_user_followed_stores_location_id ON user_followed_stores (location_id);

-- ============================================================================
-- LOCATION MANAGERS
-- ============================================================================

CREATE TABLE location_managers (
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, user_id)
);

CREATE INDEX idx_location_managers_user_id ON location_managers (user_id);

-- ============================================================================
-- LOCATION SUBMISSIONS
-- ============================================================================

CREATE TABLE location_submissions (
  id                        TEXT PRIMARY KEY,

  -- Submitter
  submitter_name            TEXT NOT NULL,
  submitter_email           TEXT NOT NULL,
  submitter_phone           TEXT,
  submitter_relationship    submitter_relationship NOT NULL,

  -- Store info
  store_name                TEXT NOT NULL,
  store_address_line1       TEXT NOT NULL,
  store_address_city        TEXT NOT NULL,
  store_address_state       TEXT NOT NULL,
  store_address_postal_code TEXT NOT NULL,
  store_address_country     TEXT NOT NULL,
  store_contact_phone       TEXT,
  store_contact_email       TEXT,
  store_contact_website     TEXT,
  store_manager_name        TEXT,
  store_manager_email       TEXT,
  store_manager_phone       TEXT,
  tcgplayer_storefront_url  TEXT,
  discord_invite_url        TEXT,
  notes                     TEXT,

  -- Admin review
  status            submission_status NOT NULL DEFAULT 'pending',
  admin_notes       TEXT,
  approved_by       TEXT REFERENCES users(id),
  approved_at       TIMESTAMP,
  rejected_by       TEXT REFERENCES users(id),
  rejected_at       TIMESTAMP,
  rejection_reason  TEXT,

  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_location_submissions_status ON location_submissions (status, created_at DESC);
CREATE INDEX idx_location_submissions_email  ON location_submissions (submitter_email);

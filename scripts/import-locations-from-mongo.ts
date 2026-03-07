/**
 * Imports legacy MongoDB locations into the PostgreSQL locations table.
 *
 * - Reuses the existing `location_id` nanoid as the PK
 * - Encrypts contact and manager emails
 * - Skips empty string fields (stores NULL instead)
 * - Idempotent: uses ON CONFLICT DO NOTHING so safe to re-run
 *
 * Run: npx ts-node --skip-project --esm scripts/import-locations-from-mongo.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SOURCE_FILE = '/Users/eko/cards_to_printings/data_prep_for_db_copy/api_enhanced_json/historical_data/run_20250727_235335/mongodb_backup_20250727_231744/locations/locations.json';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// ============================================================================
// Encryption (matches lib/encryption.ts)
// ============================================================================

const ENCRYPTION_KEY = process.env.ADDRESS_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

function encryptEmail(email: string): { encrypted: string; iv: string } | null {
  if (!email || !email.trim()) return null;
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('ADDRESS_ENCRYPTION_KEY must be a 64-character hex string');
  }
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(email.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

// ============================================================================
// Helpers
// ============================================================================

function str(val: string | undefined | null): string | null {
  if (!val || !val.trim()) return null;
  return val.trim();
}

function arr(val: string[] | undefined | null): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v) => v && v.trim());
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const docs: any[] = JSON.parse(raw);

  console.log(`Loaded ${docs.length} location documents`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const doc of docs) {
      const id = doc.location_id;
      if (!id) {
        console.warn(`  SKIP — no location_id on doc ${doc._id}`);
        skipped++;
        continue;
      }

      const contactEmailEnc = encryptEmail(doc.contact?.email);
      const managerEmailEnc = encryptEmail(doc.manager?.email);

      const values = [
        id,                                          // $1  id
        'store',                                     // $2  category
        doc.name?.trim(),                            // $3  name
        str(doc.address?.line1),                     // $4  address_line1
        str(doc.address?.city),                      // $5  address_city
        str(doc.address?.state) ,                    // $6  address_state
        str(doc.address?.postal_code),               // $7  address_postal_code
        str(doc.address?.country),                   // $8  address_country
        doc.country_id ?? null,                      // $9  address_country_id
        null,                                        // $10 address_state_id (not in mongo)
        str(doc.contact?.phone),                     // $11 contact_phone
        contactEmailEnc?.encrypted ?? null,          // $12 contact_email
        contactEmailEnc?.iv ?? null,                 // $13 contact_email_iv
        str(doc.contact?.website),                   // $14 contact_website
        str(doc.externalIds?.tcgplayer),             // $15 tcgplayer_id
        str(doc.externalIds?.google),                // $16 google_place_id
        str(doc.externalIds?.facebook),              // $17 facebook_id
        str(doc.tcgplayer_storefront_url),           // $18 tcgplayer_storefront_url
        str(doc.discord_invite_url),                 // $19 discord_invite_url
        arr(doc.tags),                               // $20 tags
        doc.active ?? true,                          // $21 active
        str(doc.geo?.lat),                           // $22 geo_lat
        str(doc.geo?.lng),                           // $23 geo_lng
        arr(doc.images),                             // $24 images
        str(doc.manager?.name),                      // $25 manager_name
        managerEmailEnc?.encrypted ?? null,          // $26 manager_email
        managerEmailEnc?.iv ?? null,                 // $27 manager_email_iv
        str(doc.manager?.phone),                     // $28 manager_phone
        str(doc.notes),                              // $29 notes
        doc.createdAt ? new Date(doc.createdAt) : new Date(),  // $30 created_at
        doc.updatedAt ? new Date(doc.updatedAt) : new Date(),  // $31 updated_at
      ];

      try {
        const result = await client.query(
          `INSERT INTO locations (
            id, category, name,
            address_line1, address_city, address_state, address_postal_code,
            address_country, address_country_id, address_state_id,
            contact_phone, contact_email, contact_email_iv, contact_website,
            tcgplayer_id, google_place_id, facebook_id,
            tcgplayer_storefront_url, discord_invite_url,
            tags, active, geo_lat, geo_lng, images,
            manager_name, manager_email, manager_email_iv, manager_phone,
            notes, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,
            $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
          )
          ON CONFLICT (id) DO NOTHING`,
          values
        );

        if (result.rowCount === 0) {
          console.log(`  SKIP (already exists): ${id} — ${doc.name}`);
          skipped++;
        } else {
          console.log(`  OK: ${id} — ${doc.name}`);
          inserted++;
        }
      } catch (err: any) {
        console.error(`  ERROR: ${id} — ${doc.name}: ${err.message}`);
        errors++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\nDone — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

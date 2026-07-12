/**
 * PostgreSQL Schema for FaB Bazaar
 *
 * Normalized relational design using Drizzle ORM
 * No denormalization - uses JOINs for related data
 */

import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  integer,
  bigint,
  real,
  numeric,
  smallint,
  uniqueIndex,
  index,
  pgEnum,
  jsonb,
  primaryKey,
  type AnyPGColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const visibilityLevelEnum = pgEnum('visibility_level', [
  'public',
  'private',
  'friends',
  'unlisted'
]);

export const conditionEnum = pgEnum('condition', [
  'NM',  // Near Mint
  'LP',  // Lightly Played
  'MP',  // Moderately Played
  'HP',  // Heavily Played
  'DMG'  // Damaged
]);

export const priorityEnum = pgEnum('priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

export const deckCategoryEnum = pgEnum('deck_category', [
  'hero',
  'equipment',
  'maindeck',
  'inventory',
  'benched',
  'tokens',
]);

export const locationCategoryEnum = pgEnum('location_category', ['store', 'venue']);

export const eventTypeEnum = pgEnum('event_type', [
  'calling',
  'pro_tour',
  'national',
  'open',
  'store_champ',
  'other',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'approved',
  'rejected',
  'needs_review',
]);

export const submitterRelationshipEnum = pgEnum('submitter_relationship', [
  'owner',
  'manager',
  'employee',
  'customer',
  'other',
]);

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayUsername: text('display_username'),  // Original casing
  email: text('email').unique(),  // Encrypted
  emailHash: text('email_hash'),  // For searching
  emailIV: text('email_iv'),  // Encryption IV
  passwordHash: text('password_hash'),
  isPasswordPreHashed: boolean('is_password_pre_hashed').default(false),

  // Discord integration
  discordId: text('discord_id').unique(),
  discordUsername: text('discord_username'),
  discordAvatar: text('discord_avatar'),
  avatarUrl: text('avatar_url'),

  clientHash: text('client_hash'),

  // Metafy account linking
  metafyId: text('metafy_id').unique(),
  metafyUsername: text('metafy_username'),
  metafyAccessToken: text('metafy_access_token'),
  metafyAccessTokenIv: text('metafy_access_token_iv'),
  metafyRefreshToken: text('metafy_refresh_token'),
  metafyRefreshTokenIv: text('metafy_refresh_token_iv'),
  metafyTokenExpiry: timestamp('metafy_token_expiry'),
  metafyPartner: boolean('metafy_partner').default(false),

  // Location (coarse, user-set on /profile/edit — no city/coords by design)
  countryCode: text('country_code'),
  // Volzar localization override; NULL = auto (country_code → English)
  preferredLanguage: text('preferred_language'),
  stateCode: text('state_code'),

  // Roles
  isAdmin: boolean('is_admin').default(false).notNull(),
  isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
  isContentCreator: boolean('is_content_creator').default(false).notNull(),
  canManageLocations: boolean('can_manage_locations').default(false).notNull(),
  canImportCardCollections: boolean('can_import_card_collections').default(false).notNull(),
  canModerateForums: boolean('can_moderate_forums').default(false).notNull(),

  // Account types
  isStore: boolean('is_store').default(false),
  storeId: text('store_id'),
  isLocalGamingStore: boolean('is_local_gaming_store').default(false).notNull(),
  isMetafySupporter: boolean('is_metafy_supporter').default(false).notNull(),
  // Hosted-chat supporter tier: 'free' | 'paid'. Synced from Metafy community
  // membership (paid tier) or set manually by a superadmin. Gates Volzar.
  metafySupporterTier: text('metafy_supporter_tier').default('free').notNull(),
  // Manual Volzar grant (superadmin-toggled on /admin/user-access) for users
  // who can't get Metafy status. OR'd into canUseVolzar; sync never touches it.
  volzarAccess: boolean('volzar_access').default(false).notNull(),
  isCurator: boolean('is_curator').default(false).notNull(),
  isShop: boolean('is_shop').default(false).notNull(),
  isTcgSeller: boolean('is_tcg_seller').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  discordIdIdx: index('idx_users_discord_id').on(table.discordId),
  usernameIdx: index('idx_users_username').on(table.username),
  emailHashIdx: index('idx_users_email_hash').on(table.emailHash),
}));

// ============================================================================
// METAFY COMMUNITIES
// ============================================================================

export const metafyCommunities = pgTable('metafy_communities', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  communityId: text('community_id').notNull(),
  title: text('title').notNull(),
  tiers: jsonb('tiers'),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
}, (table) => ({
  userCommunityUnique: uniqueIndex('metafy_communities_user_community_unique').on(table.userId, table.communityId),
  userIdIdx: index('idx_metafy_communities_user_id').on(table.userId),
}));

// ============================================================================
// ARTICLES
// ============================================================================

export const articles = pgTable('articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  publicId: text('public_id').notNull().unique(),
  slug: text('slug').unique(),
  content: text('content'),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'), // 'draft' | 'published'
  contentType: text('content_type').notNull(), // 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament'
  categories: text('categories').array(),
  image: text('image'),
  sections: jsonb('sections'), // Array of section objects (7 types: text, card-carousel, video, etc.)
  isUserArticle: boolean('is_user_article').default(false).notNull(),
  promoted: boolean('promoted').default(false).notNull(),
  heroSlug: text('hero_slug'),
  heroClass: text('hero_class'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  authorIdIdx: index('idx_articles_author_id').on(table.authorId),
  publicIdIdx: index('idx_articles_public_id').on(table.publicId),
  slugIdx: index('idx_articles_slug').on(table.slug),
  statusIdx: index('idx_articles_status').on(table.status),
  isUserArticleIdx: index('idx_articles_is_user').on(table.isUserArticle),
  promotedIdx: index('idx_articles_promoted').on(table.promoted),
  heroSlugIdx: index('idx_articles_hero_slug').on(table.heroSlug),
  heroClassIdx: index('idx_articles_hero_class').on(table.heroClass),
  userArticleComposite: index('idx_articles_user_composite').on(table.isUserArticle, table.authorId, table.status),
}));

// ============================================================================
// BINDERS
// ============================================================================

export const binders = pgTable('binders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  slug: text('slug'),
  description: text('description'),
  isPublic: boolean('is_public').default(true).notNull(),

  // Visibility settings
  visibilityLevel: visibilityLevelEnum('visibility_level').default('public'),
  allowInSearch: boolean('allow_in_search').default(true).notNull(),
  allowInMatching: boolean('allow_in_matching').default(true).notNull(),
  allowDiscordCommands: boolean('allow_discord_commands').default(true).notNull(),
  allowApiExport: boolean('allow_api_export').default(true).notNull(),
  allowWhoHas: boolean('allow_who_has').default(true).notNull(),
  allowWebhooks: boolean('allow_webhooks').default(false).notNull(),

  // Soft delete / archival
  archived: boolean('archived').default(false).notNull(),

  // Navbar pinning — when true, this binder appears in the user's navbar dropdown.
  // If a user has none pinned, the navbar falls back to most-recently-updated.
  pinnedInNav: boolean('pinned_in_nav').default(false).notNull(),

  // Owner-defined labels used to group binders into sections on the public
  // profile. Flat (no hierarchy); a binder may carry several. Empty by default.
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

  // Stats tracking
  statsNeedUpdate: boolean('stats_need_update').default(true).notNull(),
  statsUpdatedAt: timestamp('stats_updated_at'),

  // Activity tracking (null = never touched after migration)
  lastActivityAt: timestamp('last_activity_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_binders_user_id').on(table.userId),
  isPublicIdx: index('idx_binders_is_public').on(table.isPublic).where(sql`${table.isPublic} = true`),
  pinnedInNavIdx: index('idx_binders_pinned_nav').on(table.userId).where(sql`${table.pinnedInNav} = true`),
  statsDirtyIdx: index('idx_binders_stats_dirty').on(table.statsNeedUpdate).where(sql`${table.statsNeedUpdate} = true`),
  lastActivityAtIdx: index('idx_binders_last_activity_at').on(table.lastActivityAt),
  uniqueUserName: uniqueIndex('unique_binders_user_name').on(table.userId, table.name),
}));

// ============================================================================
// CARDS (Card-level data - shared across all printings)
// ============================================================================

export const cards = pgTable('cards', {
  cardUniqueId: text('card_unique_id').primaryKey(),

  // Card identity
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),

  // Talishar's internal identifier for this card, derived deterministically
  // from (display_name, pitch). See lib/talishar/cardId.ts. Populated by the
  // pipeline. Indexed for fast Talishar-id → card lookups (e.g. resolving
  // card_results from game logs to printings/images).
  talisharCardId: text('talishar_card_id'),

  // Upstream LSS card UUID (from cardvault.fabtcg.com feed). NOT unique:
  // DFCs share one LSS UUID across both faces' card_unique_ids. Populated
  // by scripts/import-i18n.ts; NULL for cards never seen in the LSS feed.
  lssCardId: text('lss_card_id'),

  // Card text & abilities
  text: text('text'),
  searchableText: text('searchable_text'),
  typeText: text('type_text'),
  typeTextDisplay: text('type_text_display'),

  // Arrays (PostgreSQL supports native arrays)
  types: text('types').array(),
  traits: text('traits').array(),
  keywords: text('keywords').array(),
  keywordsDisplay: text('keywords_display').array(),
  abilities: text('abilities').array(),
  classes: text('classes').array(),
  talents: text('talents').array(),
  // Hero-only: list of essence card pools the hero grants access to (Terra
  // → {earth}, Oldhim → {earth,ice}). Empty for every non-hero card.
  // Populated by pipeline 003 from the "essence of X" keyword pattern.
  essences: text('essences').array().notNull().default(sql`ARRAY[]::text[]`),

  // Game stats
  power: integer('power'),
  powerText: text('power_text'),
  cost: integer('cost'),
  costText: text('cost_text'),
  defense: integer('defense'),
  defenseText: text('defense_text'),
  // Arcane damage dealt when played (fab-cube `arcane` field, pipeline 003).
  // NULL = none; "X"/variable amounts stay NULL with the token in arcaneText.
  arcane: integer('arcane'),
  arcaneText: text('arcane_text'),
  pitch: integer('pitch'),
  pitchText: text('pitch_text'),
  health: integer('health'),
  intelligence: integer('intelligence'),
  color: text('color'),  // red, yellow, blue, or empty string

  // Card type flags
  isAction: boolean('is_action').default(false).notNull(),
  isAttack: boolean('is_attack').default(false).notNull(),
  isDefenseReaction: boolean('is_defense_reaction').default(false).notNull(),
  isInstant: boolean('is_instant').default(false).notNull(),
  isEquipment: boolean('is_equipment').default(false).notNull(),
  isWeapon: boolean('is_weapon').default(false).notNull(),
  isHero: boolean('is_hero').default(false).notNull(),
  isMentor: boolean('is_mentor').default(false).notNull(),
  isToken: boolean('is_token').default(false).notNull(),
  playedHorizontally: boolean('played_horizontally').default(false).notNull(),

  // Class flags
  isGeneric: boolean('is_generic').default(false).notNull(),
  isBrute: boolean('is_brute').default(false).notNull(),
  isGuardian: boolean('is_guardian').default(false).notNull(),
  isMechanologist: boolean('is_mechanologist').default(false).notNull(),
  isRanger: boolean('is_ranger').default(false).notNull(),
  isRuneblade: boolean('is_runeblade').default(false).notNull(),
  isAssassin: boolean('is_assassin').default(false).notNull(),
  isWarrior: boolean('is_warrior').default(false).notNull(),
  isNinja: boolean('is_ninja').default(false).notNull(),
  isWizard: boolean('is_wizard').default(false).notNull(),
  isMerchant: boolean('is_merchant').default(false).notNull(),
  isBard: boolean('is_bard').default(false).notNull(),
  isAdjudicator: boolean('is_adjudicator').default(false).notNull(),
  isIllusionist: boolean('is_illusionist').default(false).notNull(),
  isThief: boolean('is_thief').default(false).notNull(),
  isShapeshifter: boolean('is_shapeshifter').default(false).notNull(),
  isNecromancer: boolean('is_necromancer').default(false).notNull(),

  // Talent flags
  hasChaos: boolean('has_chaos').default(false).notNull(),
  hasLight: boolean('has_light').default(false).notNull(),
  hasRoyal: boolean('has_royal').default(false).notNull(),
  hasDraconic: boolean('has_draconic').default(false).notNull(),
  hasLightning: boolean('has_lightning').default(false).notNull(),
  hasShadow: boolean('has_shadow').default(false).notNull(),
  hasEarth: boolean('has_earth').default(false).notNull(),
  hasMystic: boolean('has_mystic').default(false).notNull(),
  hasRevered: boolean('has_revered').default(false).notNull(),
  hasIce: boolean('has_ice').default(false).notNull(),
  hasReviled: boolean('has_reviled').default(false).notNull(),
  hasPirate: boolean('has_pirate').default(false).notNull(),
  hasElemental: boolean('has_elemental').default(false).notNull(),

  // Combination flags
  isGenericOnly: boolean('is_generic_only').default(false).notNull(),
  hasClassAndTalent: boolean('has_class_and_talent').default(false).notNull(),
  hasClassOnly: boolean('has_class_only').default(false).notNull(),
  hasTalentOnly: boolean('has_talent_only').default(false).notNull(),

  // Format legality (card-level rules)
  blitzLegal: boolean('blitz_legal').default(false).notNull(),
  ccLegal: boolean('cc_legal').default(false).notNull(),
  commonerLegal: boolean('commoner_legal').default(false).notNull(),
  llLegal: boolean('ll_legal').default(false).notNull(),
  silverAgeLegal: boolean('silver_age_legal').default(false).notNull(),

  // Banned/Suspended status
  blitzBanned: boolean('blitz_banned').default(false).notNull(),
  ccBanned: boolean('cc_banned').default(false).notNull(),
  commonerBanned: boolean('commoner_banned').default(false).notNull(),
  llBanned: boolean('ll_banned').default(false).notNull(),
  blitzSuspended: boolean('blitz_suspended').default(false).notNull(),
  ccSuspended: boolean('cc_suspended').default(false).notNull(),
  commonerSuspended: boolean('commoner_suspended').default(false).notNull(),
  llRestricted: boolean('ll_restricted').default(false).notNull(),
  silverAgeBanned: boolean('silver_age_banned').default(false).notNull(),
  silverAgeSuspended: boolean('silver_age_suspended').default(false).notNull(),

  // Curated interpretive "facet" tags (what a card DOES) — projected from the
  // card_facet_tags table. Curation-owned; pipeline must NOT overwrite (in
  // CARD_ADMIN_OWNED_COLS). Vocabulary: lib/search/card-facets.ts. GIN index in
  // migration 0059 (Drizzle can't express GIN).
  facetTags: text('facet_tags').array().notNull().default(sql`ARRAY[]::text[]`),

  // Curated strategy prose (why it's good / how it's used — markdown). Also
  // curation-owned (CARD_ADMIN_OWNED_COLS); written only via facetService.
  // Per card_unique_id with NO same-name fan-out: red/blue pitches of a card
  // can play different roles, so each variant gets its own prose (0077).
  strategyNotes: text('strategy_notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('idx_cards_name').on(table.name),
  typeTextIdx: index('idx_cards_type_text').on(table.typeText),
  lssCardIdIdx: index('idx_cards_lss_card_id').on(table.lssCardId),
}));

// Curated facet vocabulary (runtime source of truth). Created/edited via the
// /admin/card-facets content manager; seeded in migration 0060 from the
// lib/search/card-facets.ts FACET_TAGS const (which is now seed data only).
export const facetTagDefinitions = pgTable('facet_tag_definitions', {
  id: text('id').primaryKey(), // slug, e.g. 'combo-enabler'
  dim: text('dim').notNull(), // 'mechanical' | 'strategic' | 'synergy'
  label: text('label').notNull(),
  def: text('def').notNull().default(''),
  draft: boolean('draft').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Curated facet assignments (source of truth). One row per card × tag.
// `tag` FK-references facet_tag_definitions ON DELETE RESTRICT (migration 0060) —
// a tag definition can't be deleted while assigned. Projected into
// cards.facet_tags by the facet service. Pipeline never writes either column.
export const cardFacetTags = pgTable('card_facet_tags', {
  cardUniqueId: text('card_unique_id').notNull().references(() => cards.cardUniqueId, { onDelete: 'cascade' }),
  tag: text('tag').notNull().references(() => facetTagDefinitions.id, { onDelete: 'restrict' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardUniqueId, table.tag] }),
  tagIdx: index('idx_card_facet_tags_tag').on(table.tag),
}));

// ============================================================================
// PRINTINGS (Printing-specific data - references cards)
// ============================================================================

export const printings = pgTable('printings', {
  printingId: text('printing_id').primaryKey(),
  cardUniqueId: text('card_unique_id').notNull().references(() => cards.cardUniqueId),

  // Printing identity
  setPrintingUniqueId: text('set_printing_unique_id'),
  collectorNumber: text('collector_number'),

  // Lowercase ISO 639-1 code ('en', 'fr', 'de', ...). Drives image selection
  // for the physical printing. Distinct from inventory_items.language which
  // is uppercase legacy ('EN').
  language: text('language').default('en').notNull(),

  // Set/Edition/Rarity
  set: text('set').notNull(),
  edition: text('edition').notNull(),
  foiling: text('foiling').notNull(),
  rarity: text('rarity').notNull(),

  // Edition flags
  isFirstEdition: boolean('is_first_edition').default(false).notNull(),
  isUnlimited: boolean('is_unlimited').default(false).notNull(),
  isNormalEdition: boolean('is_normal_edition').default(false).notNull(),

  // Foiling flags
  isNormalFoil: boolean('is_normal_foil').default(false).notNull(),
  isRainbowFoil: boolean('is_rainbow_foil').default(false).notNull(),
  isColdFoil: boolean('is_cold_foil').default(false).notNull(),
  isExtendedArt: boolean('is_extended_art').default(false).notNull(),

  // Rarity flags
  isCommon: boolean('is_common').default(false).notNull(),
  isRare: boolean('is_rare').default(false).notNull(),
  isSuperRare: boolean('is_super_rare').default(false).notNull(),
  isMajestic: boolean('is_majestic').default(false).notNull(),
  isLegendary: boolean('is_legendary').default(false).notNull(),
  isFabled: boolean('is_fabled').default(false).notNull(),
  isPromo: boolean('is_promo').default(false).notNull(),

  // Visual & metadata
  imageUrl: text('image_url'),
  // Cached flag: whether the Cloudflare image for this printing_id has actually
  // been uploaded. Refreshed by pipeline/scripts/audit_cloudflare_images.py
  // (diff vs the Cloudflare Images list API). A cache of Cloudflare state, not a
  // source of truth — query `= false` to find printings still missing art.
  hasCloudflareImage: boolean('has_cloudflare_image').default(false).notNull(),
  imageRotationDegrees: integer('image_rotation_degrees').default(0),
  artists: text('artists').array(),
  flavorText: text('flavor_text'),
  artVariations: text('art_variations').array(),

  // TCGPlayer integration
  tcgplayerProductId: text('tcgplayer_product_id'),
  tcgplayerUrl: text('tcgplayer_url'),
  tcgplayerSubtypeName: text('tcgplayer_subtype_name'),
  // TCGplayer group (product grouping) this printing was sold in. Source of
  // truth for sub-set packs that `set` collapses — e.g. which seasonal "GEM
  // Pack N" a GEM card belongs to. FK to tcg_groups (migration 0067).
  tcgGroupId: integer('tcg_group_id').references(() => tcgGroups.groupId),

  // Pricing (per printing - varies wildly!)
  tcgMarket: real('tcg_market'),
  tcgLow: real('tcg_low'),
  tcgMid: real('tcg_mid'),
  tcgHigh: real('tcg_high'),
  hasPrice: boolean('has_price').default(false).notNull(),
  priceUpdatedAt: timestamp('price_updated_at'),

  // Price category flags
  isBudget: boolean('is_budget').default(false).notNull(),
  isUnder5: boolean('is_under_5').default(false).notNull(),
  isUnder10: boolean('is_under_10').default(false).notNull(),
  isUnder25: boolean('is_under_25').default(false).notNull(),
  isUnder50: boolean('is_under_50').default(false).notNull(),
  isUnder100: boolean('is_under_100').default(false).notNull(),
  isExpensive: boolean('is_expensive').default(false).notNull(),
  isPremium: boolean('is_premium').default(false).notNull(),

  // System fields
  expansionSlot: boolean('expansion_slot').default(false).notNull(),
  contentHash: text('content_hash'),

  // Foil mask (rainbow foil clip-path, data-driven — overrides artStyle fallback)
  // Values are percentages (0–100). NULL = use artStyle-derived defaults.
  foilInsetTop: real('foil_inset_top'),
  foilInsetRight: real('foil_inset_right'),
  foilInsetBottom: real('foil_inset_bottom'),
  foilInsetLeft: real('foil_inset_left'),
  // border-radius portion of inset(), e.g. "1.5%", "0%", "8px". NULL = "1.5%"
  foilInsetRound: text('foil_inset_round'),
  // When true, bulk foil mask operations skip this printing
  foilInsetLocked: boolean('foil_inset_locked').default(false).notNull(),

  // Double-faced card linking
  otherFacePrintingId: text('other_face_printing_id'),
  isFrontFace: boolean('is_front_face').default(true).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  cardIdIdx: index('idx_printings_card_id').on(table.cardUniqueId),
  setIdx: index('idx_printings_set').on(table.set),
  rarityIdx: index('idx_printings_rarity').on(table.rarity),
  editionIdx: index('idx_printings_edition').on(table.edition),
  foilingIdx: index('idx_printings_foiling').on(table.foiling),
  setRarityIdx: index('idx_printings_set_rarity').on(table.set, table.rarity),
  languageIdx: index('idx_printings_language').on(table.language),
}));

// ============================================================================
// CARD TRANSLATIONS (Per-language overlay for card-level text)
// ============================================================================
// English stays on `cards`; this table holds non-English overrides only.
// Read path: LEFT JOIN + COALESCE(t.field, cards.field).
// Adding a new language is INSERT-only — no schema change.
//
// What's translated: rendered strings (name, text, type_text, traits, flavor).
// What stays canonical English on `cards`: gameplay identifiers (types[],
// keywords[], classes[], talents[], essences[]), all booleans, and all stats.

export const cardTranslations = pgTable('card_translations', {
  cardUniqueId: text('card_unique_id').notNull().references(() => cards.cardUniqueId, { onDelete: 'cascade' }),
  language: text('language').notNull(),

  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  text: text('text'),
  typeText: text('type_text'),
  traits: text('traits').array(),
  flavorText: text('flavor_text'),

  source: text('source'),
  sourceCardId: text('source_card_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardUniqueId, table.language] }),
  langNameIdx: index('idx_card_translations_lang_name').on(table.language, table.name),
}));

// ============================================================================
// INVENTORY ITEMS (User's card collection)
// ============================================================================

export const inventoryItems = pgTable('inventory_items', {
  id: text('id').primaryKey(),

  // Foreign keys (NO denormalized data - everything via JOIN!)
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  binderId: text('binder_id').notNull().references(() => binders.id, { onDelete: 'cascade' }),
  printingId: text('printing_id').notNull().references(() => printings.printingId),

  // Inventory-specific fields ONLY
  quantity: integer('quantity').notNull().default(1),
  condition: conditionEnum('condition').default('NM').notNull(),
  language: text('language').default('EN').notNull(),
  notes: text('notes'),
  forTrade: boolean('for_trade').default(false).notNull(),
  forSale: boolean('for_sale').default(false).notNull(),

  // Acquisition tracking
  acquisitionPrice: real('acquisition_price'),
  acquisitionDate: timestamp('acquisition_date'),

  // Timestamps
  addedAt: timestamp('added_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_inventory_user_id').on(table.userId),
  binderIdIdx: index('idx_inventory_binder_id').on(table.binderId),
  printingIdIdx: index('idx_inventory_printing_id').on(table.printingId),
  forTradeIdx: index('idx_inventory_for_trade').on(table.forTrade).where(sql`${table.forTrade} = true`),
  forSaleIdx: index('idx_inventory_for_sale').on(table.forSale).where(sql`${table.forSale} = true`),
  userBinderIdx: index('idx_inventory_user_binder').on(table.userId, table.binderId),
  userPrintingIdx: index('idx_inventory_user_printing').on(table.userId, table.printingId),
  uniqueBinderPrintingConditionLang: uniqueIndex('unique_inventory_binder_printing_condition_lang')
    .on(table.binderId, table.printingId, table.condition, table.language),
}));

// ============================================================================
// WANTS ITEMS (User's want list)
// ============================================================================

export const wantsItems = pgTable('wants_items', {
  id: text('id').primaryKey(),

  // Foreign keys (NO denormalized data!)
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  printingId: text('printing_id').notNull().references(() => printings.printingId),

  // Wants-specific fields ONLY
  quantity: integer('quantity').notNull().default(1),
  priority: priorityEnum('priority').default('medium').notNull(),
  notes: text('notes'),
  maxPrice: real('max_price'),  // Maximum price willing to pay

  // Timestamps
  addedAt: timestamp('added_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_wants_user_id').on(table.userId),
  printingIdIdx: index('idx_wants_printing_id').on(table.printingId),
  priorityIdx: index('idx_wants_priority').on(table.priority),
  uniqueUserPrinting: uniqueIndex('unique_wants_user_printing').on(table.userId, table.printingId),
}));

// ============================================================================
// DECKS
// ============================================================================

export const decks = pgTable('decks', {
  id: text('id').primaryKey(),
  publicId: text('public_id').notNull().unique(),  // nanoid for external routing
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  slug: text('slug'),  // URL-friendly slug (backwards compat)
  description: text('description'),
  format: text('format'),  // Classic Constructed, Blitz, etc.
  heroName: text('hero_name'),  // Name of the hero
  visibility: visibilityLevelEnum('visibility').default('unlisted').notNull(),

  // Metafy guide linking (restricts deck access to guide purchasers)
  metafyGuideId: text('metafy_guide_id'),

  // Talishar integration (opt-in to appearing in Talishar deck list)
  availableOnTalishar: boolean('available_on_talishar').notNull().default(true),

  // Featured flag for "Decks to Beat" section (curators/superadmins can toggle)
  featured: boolean('featured').notNull().default(false),

  // System deck flag — site-managed reference decks (e.g. Decks to Beat owned by superadmin).
  // Hidden from owner's personal views (navbar, decks page, Discord, MCP, Talishar sync)
  // but publicly accessible via direct URL and the Decks to Beat page.
  isSystemDeck: boolean('is_system_deck').notNull().default(false),

  // Navbar pinning — when true, this deck appears in the user's navbar dropdown.
  // If a user has none pinned, the navbar falls back to most-recently-updated.
  pinnedInNav: boolean('pinned_in_nav').notNull().default(false),

  // Event metadata (optional — drives the to-beat month filter, distinct from updatedAt)
  eventName: text('event_name'),
  eventDate: date('event_date'),
  placing: integer('placing'),

  // Optional metadata
  tags: text('tags').array(),
  metadata: jsonb('metadata'),

  // Co-owners (array of user IDs who share edit access)
  coOwners: text('co_owners').array().default([]).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_decks_user_id').on(table.userId),
  publicIdIdx: index('idx_decks_public_id').on(table.publicId),
  visibilityIdx: index('idx_decks_visibility_public').on(table.visibility).where(sql`${table.visibility} = 'public'`),
  pinnedInNavIdx: index('idx_decks_pinned_nav').on(table.userId).where(sql`${table.pinnedInNav} = true`),
  uniqueUserName: uniqueIndex('unique_decks_user_name').on(table.userId, table.name),
  uniqueUserSlug: index('idx_decks_user_slug').on(table.userId, table.slug),
}));

// ============================================================================
// GAME RESULTS
// ============================================================================

export const gameResultEnum = pgEnum('game_result', ['win', 'loss']);

export const gameResults = pgTable('game_results', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  talisharGameId: text('talishar_game_id'),
  talisharGameGuid: text('talishar_game_guid'),
  format: text('format'),
  playerHero: text('player_hero'),
  opponentHero: text('opponent_hero'),
  result: gameResultEnum('result').notNull(),
  conceded: boolean('conceded').default(false).notNull(),
  firstPlayer: boolean('first_player'),
  totalTurns: integer('total_turns'),
  cardResults: jsonb('card_results'),
  turnResults: jsonb('turn_results'),
  turnLog: jsonb('turn_log').$type<[number, string, string][]>(),
  opponentCardResults: jsonb('opponent_card_results'),
  opponentTurnLog: jsonb('opponent_turn_log').$type<[number, string, string][]>(),
  playedAt: timestamp('played_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  deckIdIdx: index('idx_game_results_deck_id').on(table.deckId),
  deckPlayedIdx: index('idx_game_results_deck_played').on(table.deckId, table.playedAt),
  uniqueDeckGuid: uniqueIndex('idx_game_results_deck_guid').on(table.deckId, table.talisharGameGuid),
}));

// Raw Talishar payload archive (sidecar to game_results). Stores the full deck
// blob verbatim — including the fields the typed game_results columns drop
// (arenaCardResults, tokenResults, character, precomputed aggregates). Written
// for every archived game; opponent data is consent-gated, and reads are
// owner/co-owner-gated at the route — so each player only ever sees their own.
// Separate table so it can be dropped wholesale and never leaks into a default
// game_results SELECT. See migration 0069.
export const gameResultPayloads = pgTable('game_result_payloads', {
  resultId: text('result_id').primaryKey().references(() => gameResults.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// OAUTH CLIENTS
// ============================================================================

export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret').notNull(),
  clientName: text('client_name').notNull(),

  // User linkage (for user-specific clients)
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  username: text('username'),  // Denormalized for convenience

  // OAuth 2.1 settings
  redirectUris: text('redirect_uris').array().default([]).notNull(),
  grantTypes: text('grant_types').array().default(['client_credentials']).notNull(),
  responseTypes: text('response_types').array().default(['token']).notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').default('client_secret_basic').notNull(),
  scope: text('scope').default('read write').notNull(),
  clientUri: text('client_uri'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  clientIdIssuedAt: integer('client_id_issued_at').notNull(),
  lastUsed: timestamp('last_used'),
}, (table) => ({
  clientIdIdx: index('idx_oauth_clients_client_id').on(table.clientId),
  userIdIdx: index('idx_oauth_clients_user_id').on(table.userId),
}));

// ============================================================================
// MCP USAGE (daily aggregates per user × client × tool — see migration 0072)
// ============================================================================

export const mcpUsageDaily = pgTable('mcp_usage_daily', {
  usageDate: date('usage_date', { mode: 'string' }).notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client: text('client').notNull().default('unknown'),
  tool: text('tool').notNull(),
  calls: integer('calls').notNull().default(0),
  requestBytes: integer('request_bytes').notNull().default(0),
  responseBytes: integer('response_bytes').notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.usageDate, table.userId, table.client, table.tool] }),
  userIdx: index('idx_mcp_usage_daily_user').on(table.userId, table.usageDate),
}));

// ============================================================================
// LLM USAGE (daily aggregates per user × model — see migration 0073)
// ============================================================================

export const llmUsageDaily = pgTable('llm_usage_daily', {
  usageDate: date('usage_date', { mode: 'string' }).notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  requests: integer('requests').notNull().default(0),
  promptTokens: bigint('prompt_tokens', { mode: 'number' }).notNull().default(0),
  completionTokens: bigint('completion_tokens', { mode: 'number' }).notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.usageDate, table.userId, table.model] }),
  userIdx: index('idx_llm_usage_daily_user').on(table.userId, table.usageDate),
}));

// ============================================================================
// OAUTH AUTHORIZATION CODES
// ============================================================================

export const oauthAuthorizationCodes = pgTable('oauth_authorization_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),

  // References
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull(),

  // OAuth parameters
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').notNull(),

  // PKCE (Proof Key for Code Exchange)
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),

  // Lifecycle
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: index('idx_oauth_codes_code').on(table.code),
  clientIdIdx: index('idx_oauth_codes_client_id').on(table.clientId),
  userIdIdx: index('idx_oauth_codes_user_id').on(table.userId),
  expiresAtIdx: index('idx_oauth_codes_expires_at').on(table.expiresAt),
}));

// ============================================================================
// OAUTH ACCESS TOKENS
// ============================================================================

export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: text('id').primaryKey(),
  accessToken: text('access_token').notNull().unique(),
  tokenType: text('token_type').default('bearer').notNull(),

  // References
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull(),

  // OAuth parameters
  scope: text('scope').notNull(),

  // Token lifecycle
  expiresAt: timestamp('expires_at').notNull(),
  refreshToken: text('refresh_token').unique(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  accessTokenIdx: index('idx_oauth_tokens_access_token').on(table.accessToken),
  refreshTokenIdx: index('idx_oauth_tokens_refresh_token').on(table.refreshToken),
  clientIdIdx: index('idx_oauth_tokens_client_id').on(table.clientId),
  userIdIdx: index('idx_oauth_tokens_user_id').on(table.userId),
  expiresAtIdx: index('idx_oauth_tokens_expires_at').on(table.expiresAt),
}));

// ============================================================================
// DECK CARDS (Deck card list - join table)
// ============================================================================

export const deckCards = pgTable('deck_cards', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  printingId: text('printing_id').notNull().references(() => printings.printingId),

  quantity: integer('quantity').notNull().default(1),
  category: deckCategoryEnum('category').notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),

  // NOTE: pitch is redundant - get from cards table via JOIN
  // pitch: integer('pitch'),  // REMOVED - use cards.pitch instead
}, (table) => ({
  deckIdIdx: index('idx_deck_cards_deck_id').on(table.deckId),
  printingIdIdx: index('idx_deck_cards_printing_id').on(table.printingId),
  uniqueDeckPrintingCategory: uniqueIndex('unique_deck_cards_deck_printing_category')
    .on(table.deckId, table.printingId, table.category),
}));

// ============================================================================
// LEAGUES (community-run tournament series — e.g. InkBlade League)
// ============================================================================
// See migration 0047_add_leagues.sql for design notes.
// - Owner may be NULL: if the creator deletes their account the league
//   survives ownerless. Result rows similarly preserve historical play
//   data even after the user is gone.
// - Discord remains the source of truth for "who's in the community";
//   league_members / signups are deferred to a later migration.

export const leagues = pgTable('leagues', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  format: text('format'),
  bannerUrl: text('banner_url'),
  discordGuildId: text('discord_guild_id'),
  discordInviteUrl: text('discord_invite_url'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  public: boolean('public').notNull().default(true),
  scheduleSummary: text('schedule_summary'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdIdx: index('idx_leagues_owner_id').on(table.ownerId),
  publicIdx: index('idx_leagues_public').on(table.public).where(sql`${table.public} = true`),
}));

export const leagueEvents = pgTable('league_events', {
  id: text('id').primaryKey(),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: text('status').notNull().default('upcoming'), // upcoming | in_progress | complete | cancelled
  format: text('format'),
  public: boolean('public').notNull().default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  leagueScheduledIdx: index('idx_league_events_league_scheduled').on(table.leagueId, table.scheduledFor),
  publicUpcomingIdx: index('idx_league_events_public_upcoming')
    .on(table.scheduledFor)
    .where(sql`${table.public} = true AND ${table.status} IN ('upcoming', 'in_progress')`),
}));

export const leagueEventDecks = pgTable('league_event_decks', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => leagueEvents.id, { onDelete: 'cascade' }),
  deckId: text('deck_id').references(() => decks.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  playerHandle: text('player_handle').notNull(), // Discord username or anonymous tag; never anything more identifying
  // Denormalized at result-recording time so hero info survives deck deletion.
  heroName: text('hero_name'),
  placing: integer('placing'),
  matchRecord: text('match_record'), // free-form, e.g. "5-1-0"
  droppedRound: integer('dropped_round'),
  byes: integer('byes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventPlacingIdx: index('idx_league_event_decks_event_placing').on(table.eventId, table.placing),
  userIdIdx: index('idx_league_event_decks_user').on(table.userId).where(sql`${table.userId} IS NOT NULL`),
  deckIdIdx: index('idx_league_event_decks_deck').on(table.deckId).where(sql`${table.deckId} IS NOT NULL`),
}));

// ============================================================================
// RELATIONS (for Drizzle queries)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
  binders: many(binders),
  inventoryItems: many(inventoryItems),
  wantsItems: many(wantsItems),
  decks: many(decks),
  oauthClients: many(oauthClients),
  followedStores: many(userFollowedStores),
  managedLocations: many(locationManagers),
  eventAttendances: many(eventAttendance),
  ownedLeagues: many(leagues),
  leagueEventDecks: many(leagueEventDecks),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  owner: one(users, {
    fields: [leagues.ownerId],
    references: [users.id],
  }),
  events: many(leagueEvents),
}));

export const leagueEventsRelations = relations(leagueEvents, ({ one, many }) => ({
  league: one(leagues, {
    fields: [leagueEvents.leagueId],
    references: [leagues.id],
  }),
  decks: many(leagueEventDecks),
}));

export const leagueEventDecksRelations = relations(leagueEventDecks, ({ one }) => ({
  event: one(leagueEvents, {
    fields: [leagueEventDecks.eventId],
    references: [leagueEvents.id],
  }),
  deck: one(decks, {
    fields: [leagueEventDecks.deckId],
    references: [decks.id],
  }),
  user: one(users, {
    fields: [leagueEventDecks.userId],
    references: [users.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
}));

export const bindersRelations = relations(binders, ({ one, many }) => ({
  user: one(users, {
    fields: [binders.userId],
    references: [users.id],
  }),
  inventoryItems: many(inventoryItems),
}));

export const cardsRelations = relations(cards, ({ many }) => ({
  printings: many(printings),
  translations: many(cardTranslations),
}));

export const cardTranslationsRelations = relations(cardTranslations, ({ one }) => ({
  card: one(cards, {
    fields: [cardTranslations.cardUniqueId],
    references: [cards.cardUniqueId],
  }),
}));

export const printingsRelations = relations(printings, ({ one, many }) => ({
  card: one(cards, {
    fields: [printings.cardUniqueId],
    references: [cards.cardUniqueId],
  }),
  inventoryItems: many(inventoryItems),
  wantsItems: many(wantsItems),
  deckCards: many(deckCards),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  user: one(users, {
    fields: [inventoryItems.userId],
    references: [users.id],
  }),
  binder: one(binders, {
    fields: [inventoryItems.binderId],
    references: [binders.id],
  }),
  printing: one(printings, {
    fields: [inventoryItems.printingId],
    references: [printings.printingId],
  }),
}));

export const wantsItemsRelations = relations(wantsItems, ({ one }) => ({
  user: one(users, {
    fields: [wantsItems.userId],
    references: [users.id],
  }),
  printing: one(printings, {
    fields: [wantsItems.printingId],
    references: [printings.printingId],
  }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, {
    fields: [decks.userId],
    references: [users.id],
  }),
  deckCards: many(deckCards),
}));

export const deckCardsRelations = relations(deckCards, ({ one }) => ({
  deck: one(decks, {
    fields: [deckCards.deckId],
    references: [decks.id],
  }),
  printing: one(printings, {
    fields: [deckCards.printingId],
    references: [printings.printingId],
  }),
}));

export const oauthClientsRelations = relations(oauthClients, ({ one }) => ({
  user: one(users, {
    fields: [oauthClients.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// SETS (reference data — source of truth for set metadata; migration 0061)
// ============================================================================

export const sets = pgTable('sets', {
  code: text('code').primaryKey(),                    // lowercase, matches printings.set
  displayCode: text('display_code').notNull(),        // e.g. 'WTR'
  name: text('name').notNull(),
  releaseDate: date('release_date'),                  // NULL = unannounced
  releaseOrder: integer('release_order').notNull().unique(),
  displayOrder: integer('display_order').notNull().unique(), // curated printing-display ranking (lower = earlier)
  category: text('category').notNull().default('non-standard'), // standard | armory | non-standard | excluded
  tier: smallint('tier').notNull().default(5),        // 1 main … 5 promo (display order 1→2→5→3→4)
  isCore: boolean('is_core').notNull().default(false),
  hasFirstEdition: boolean('has_first_edition').notNull().default(false),
  unlimitedBeforeFirst: boolean('unlimited_before_first').notNull().default(false),
  defaultRarity: text('default_rarity'),
  imageId: text('image_id'),                          // Cloudflare image id (set logo)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  releaseOrderIdx: index('idx_sets_release_order').on(table.releaseOrder),
}));

// ============================================================================
// TCG GROUPS (TCGplayer product-group dimension — migration 0067)
// ============================================================================
// Source of truth for sub-set product groupings that `printings.set` collapses.
// A TCGplayer group is coarser than our set codes (group→set is many-to-many),
// so the only link is per-printing via `printings.tcgGroupId`. Motivating case:
// each seasonal "GEM Pack N" is its own group but all map to the `gem` set code.
// Names/dates are canonical from tcgcsv (https://tcgcsv.com/tcgplayer/62/groups).

export const tcgGroups = pgTable('tcg_groups', {
  groupId: integer('group_id').primaryKey(),        // TCGplayer group id
  name: text('name').notNull(),                     // e.g. 'GEM Pack 5'
  abbreviation: text('abbreviation'),               // e.g. 'GEM'
  publishedOn: date('published_on'),                // seasonal release marker
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// SITE SETTINGS
// ============================================================================

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// GEO REFERENCE TABLES (read-only, seeded once)
// ============================================================================

export const countries = pgTable('countries', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  iso2: text('iso2').notNull().unique(),
  iso3: text('iso3'),
  phoneCode: text('phone_code'),
});

export const states = pgTable('states', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  stateCode: text('state_code').notNull(),
  countryId: integer('country_id').notNull().references(() => countries.id),
}, (table) => ({
  uniqueStateCountry: uniqueIndex('unique_states_state_country').on(table.stateCode, table.countryId),
}));

// ============================================================================
// LOCATIONS (stores, venues — all physical FaB gathering places)
// ============================================================================

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  category: locationCategoryEnum('category').notNull().default('store'),
  name: text('name').notNull(),

  // Address
  addressLine1: text('address_line1').notNull(),
  addressCity: text('address_city').notNull(),
  addressState: text('address_state'),
  addressPostalCode: text('address_postal_code'),
  addressCountry: text('address_country').notNull(),
  addressCountryId: integer('address_country_id').references(() => countries.id),
  addressStateId: integer('address_state_id').references(() => states.id),

  // Contact (emails stored AES-256-CBC encrypted)
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  contactEmailIv: text('contact_email_iv'),
  contactWebsite: text('contact_website'),

  // External IDs
  tcgplayerId: text('tcgplayer_id'),
  googlePlaceId: text('google_place_id'),
  facebookId: text('facebook_id'),
  tcgplayerStorefrontUrl: text('tcgplayer_storefront_url'),
  discordInviteUrl: text('discord_invite_url'),

  // Meta
  tags: text('tags').array().default([]),
  active: boolean('active').default(true).notNull(),
  geoLat: text('geo_lat'),
  geoLng: text('geo_lng'),
  images: text('images').array().default([]),

  // Manager contact (email encrypted)
  managerName: text('manager_name'),
  managerEmail: text('manager_email'),
  managerEmailIv: text('manager_email_iv'),
  managerPhone: text('manager_phone'),

  notes: text('notes'),
  followerCount: integer('follower_count').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('idx_locations_category').on(table.category),
  countryIdx: index('idx_locations_country').on(table.addressCountry),
  stateIdx: index('idx_locations_state').on(table.addressState),
  countryIdIdx: index('idx_locations_country_id').on(table.addressCountryId),
  stateIdIdx: index('idx_locations_state_id').on(table.addressStateId),
  activeIdx: index('idx_locations_active').on(table.active),
  // GIN full-text index defined in SQL migration (expression index, not expressible in Drizzle)
}));

// ============================================================================
// EVENTS (one-time gatherings at a location)
// ============================================================================

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  locationId: text('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: eventTypeEnum('type').notNull().default('other'),
  format: text('format'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  registrationUrl: text('registration_url'),
  discordInviteUrl: text('discord_invite_url'),
  notes: text('notes'),
  active: boolean('active').default(true).notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  locationIdIdx: index('idx_events_location_id').on(table.locationId),
  datesIdx: index('idx_events_dates').on(table.startDate, table.endDate),
  typeIdx: index('idx_events_type').on(table.type),
  activeStartIdx: index('idx_events_active_start').on(table.active, table.startDate),
}));

// ============================================================================
// EVENT ATTENDANCE
// ============================================================================

export const eventAttendance = pgTable('event_attendance', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bringingTrades: boolean('bringing_trades').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.userId] }),
  userIdIdx: index('idx_event_attendance_user_id').on(table.userId),
}));

// ============================================================================
// USER FOLLOWED STORES (permanent, explicit follow)
// ============================================================================

export const userFollowedStores = pgTable('user_followed_stores', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationId: text('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  followedAt: timestamp('followed_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.locationId] }),
  locationIdIdx: index('idx_user_followed_stores_location_id').on(table.locationId),
}));

// ============================================================================
// LOCATION MANAGERS
// ============================================================================

export const locationManagers = pgTable('location_managers', {
  locationId: text('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.locationId, table.userId] }),
  userIdIdx: index('idx_location_managers_user_id').on(table.userId),
}));

// ============================================================================
// LOCATION SUBMISSIONS (community requests to add a location)
// ============================================================================

export const locationSubmissions = pgTable('location_submissions', {
  id: text('id').primaryKey(),

  // Submitter info
  submitterName: text('submitter_name').notNull(),
  submittedByUserId: text('submitted_by_user_id').references(() => users.id),
  submitterPhone: text('submitter_phone'),
  submitterRelationship: submitterRelationshipEnum('submitter_relationship').notNull(),

  // Store info
  storeName: text('store_name').notNull(),
  storeAddressLine1: text('store_address_line1').notNull(),
  storeAddressCity: text('store_address_city').notNull(),
  storeAddressState: text('store_address_state').notNull(),
  storeAddressPostalCode: text('store_address_postal_code').notNull(),
  storeAddressCountry: text('store_address_country').notNull(),
  storeContactPhone: text('store_contact_phone'),
  storeContactEmail: text('store_contact_email'),
  storeContactWebsite: text('store_contact_website'),
  storeManagerName: text('store_manager_name'),
  storeManagerEmail: text('store_manager_email'),
  storeManagerPhone: text('store_manager_phone'),
  tcgplayerStorefrontUrl: text('tcgplayer_storefront_url'),
  discordInviteUrl: text('discord_invite_url'),
  notes: text('notes'),

  // Admin review
  status: submissionStatusEnum('status').notNull().default('pending'),
  adminNotes: text('admin_notes'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedBy: text('rejected_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusCreatedIdx: index('idx_location_submissions_status').on(table.status, table.createdAt),
}));

// ============================================================================
// RELATIONS — Locations & Events
// ============================================================================

export const countriesRelations = relations(countries, ({ many }) => ({
  states: many(states),
  locations: many(locations),
}));

export const statesRelations = relations(states, ({ one, many }) => ({
  country: one(countries, {
    fields: [states.countryId],
    references: [countries.id],
  }),
  locations: many(locations),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  country: one(countries, {
    fields: [locations.addressCountryId],
    references: [countries.id],
  }),
  state: one(states, {
    fields: [locations.addressStateId],
    references: [states.id],
  }),
  events: many(events),
  followers: many(userFollowedStores),
  managers: many(locationManagers),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  location: one(locations, {
    fields: [events.locationId],
    references: [locations.id],
  }),
  createdByUser: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
  attendees: many(eventAttendance),
}));

export const eventAttendanceRelations = relations(eventAttendance, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendance.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendance.userId],
    references: [users.id],
  }),
}));

export const userFollowedStoresRelations = relations(userFollowedStores, ({ one }) => ({
  user: one(users, {
    fields: [userFollowedStores.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [userFollowedStores.locationId],
    references: [locations.id],
  }),
}));

export const locationManagersRelations = relations(locationManagers, ({ one }) => ({
  location: one(locations, {
    fields: [locationManagers.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [locationManagers.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// CURATED LISTS
// ============================================================================

export const curatedLists = pgTable('curated_lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  heroName: text('hero_name'),
  className: text('class_name'),
  format: text('format'),
  tags: text('tags').array().default([]).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  parentId: text('parent_id').references((): AnyPGColumn => curatedLists.id, { onDelete: 'cascade' }),
  variantType: text('variant_type'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  heroNameIdx: index('idx_curated_lists_hero_name').on(table.heroName),
  classNameIdx: index('idx_curated_lists_class_name').on(table.className),
  isPublishedIdx: index('idx_curated_lists_is_published').on(table.isPublished),
  parentIdIdx: index('idx_curated_lists_parent_id').on(table.parentId),
}));

export const curatedListCards = pgTable('curated_list_cards', {
  id: text('id').primaryKey(),
  listId: text('list_id').notNull().references(() => curatedLists.id, { onDelete: 'cascade' }),
  printingId: text('printing_id').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  comment: text('comment'),
}, (table) => ({
  listIdIdx: index('idx_curated_list_cards_list_id').on(table.listId),
}));

export const curatedListsRelations = relations(curatedLists, ({ one, many }) => ({
  creator: one(users, {
    fields: [curatedLists.createdBy],
    references: [users.id],
  }),
  cards: many(curatedListCards),
}));

export const curatedListCardsRelations = relations(curatedListCards, ({ one }) => ({
  list: one(curatedLists, {
    fields: [curatedListCards.listId],
    references: [curatedLists.id],
  }),
}));

// ============================================================================
// CURATOR HERO ASSIGNMENTS
// ============================================================================

export const curatorHeroAssignments = pgTable('curator_hero_assignments', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  heroName: text('hero_name').notNull(),
  metafyProductUrl: text('metafy_product_url'),
  metafyLinkLabel: text('metafy_link_label'),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.heroName] }),
  userIdIdx: index('idx_cha_user_id').on(table.userId),
  heroNameIdx: index('idx_cha_hero_name').on(table.heroName),
}));

// ============================================================================
// CUSTOM TOKEN CARDS (fan-made FaB token cards, creator-attributed)
// ============================================================================

export const customTokenCardCreators = pgTable('custom_token_card_creators', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull().unique(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  isVerified: boolean('is_verified').default(false).notNull(),

  websiteUrl: text('website_url'),
  shopUrl: text('shop_url'),
  instagramUrl: text('instagram_url'),
  facebookUrl: text('facebook_url'),
  xUrl: text('x_url'),
  blueskyUrl: text('bluesky_url'),
  discordInviteUrl: text('discord_invite_url'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_ctcc_user_id').on(table.userId),
  slugIdx: index('idx_ctcc_slug').on(table.slug),
}));

export const customTokenCards = pgTable('custom_token_cards', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => customTokenCardCreators.id, { onDelete: 'cascade' }),
  cardUniqueId: text('card_unique_id').references(() => cards.cardUniqueId),
  externalId: text('external_id'),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),

  purchaseUrl: text('purchase_url'),
  inStock: boolean('in_stock'),
  stockUpdatedAt: timestamp('stock_updated_at'),

  isPublished: boolean('is_published').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  creatorIdIdx: index('idx_ctc_creator_id').on(table.creatorId),
  cardUniqueIdIdx: index('idx_ctc_card_unique_id').on(table.cardUniqueId),
  isPublishedIdx: index('idx_ctc_is_published').on(table.isPublished),
}));

export const customTokenCardCreatorsRelations = relations(customTokenCardCreators, ({ one, many }) => ({
  user: one(users, {
    fields: [customTokenCardCreators.userId],
    references: [users.id],
  }),
  tokenCards: many(customTokenCards),
}));

export const customTokenCardsRelations = relations(customTokenCards, ({ one }) => ({
  creator: one(customTokenCardCreators, {
    fields: [customTokenCards.creatorId],
    references: [customTokenCardCreators.id],
  }),
  card: one(cards, {
    fields: [customTokenCards.cardUniqueId],
    references: [cards.cardUniqueId],
  }),
}));

// ============================================================================
// BANNED CARDS (format-specific banned-card registry)
// ============================================================================

export const bannedCards = pgTable('banned_cards', {
  id: text('id').primaryKey(),
  cardUniqueId: text('card_unique_id').notNull(),
  format: text('format').notNull(),
  restrictionType: text('restriction_type').default('banned').notNull(),
  sourceUniqueId: text('source_unique_id'),
  statusActive: boolean('status_active').default(true).notNull(),
  dateAnnounced: timestamp('date_announced'),
  dateInEffect: timestamp('date_in_effect'),
  // Benching window (FaB Silver Age): a benched hero is in effect only while
  // now ∈ [date_in_effect, date_expires). until_set/reason mirror the policy's
  // "UNTIL Set 20 / community vote". NULL for banned/restricted/living_legend.
  dateExpires: timestamp('date_expires'),
  untilSet: text('until_set'),
  reason: text('reason'),
  legalityArticle: text('legality_article'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  cardFormatRestrictionUnique: uniqueIndex('banned_cards_card_unique_id_format_restriction_unique').on(table.cardUniqueId, table.format, table.restrictionType),
  formatActiveIdx: index('banned_cards_format_active_idx').on(table.format, table.statusActive),
  cardUniqueIdIdx: index('banned_cards_card_unique_id_idx').on(table.cardUniqueId),
}));

// ============================================================================
// DAILY MOVERS (analytical results — populated by the pipeline, NEVER from app code)
// ============================================================================
//
// One row per (as_of_date, signal_type, printing_id). Populated nightly by the
// pipeline's compute_movers step (DuckDB → Postgres reverse-ETL). The app reads
// this table to render the /daily page; nothing in the app should INSERT here.
// 1-year retention is enforced by the pipeline.

export const dailyMovers = pgTable('daily_movers', {
  asOfDate: date('as_of_date').notNull(),
  printingId: text('printing_id').notNull(),
  signalType: text('signal_type').notNull(),  // 'top_gainer' | 'top_decliner' | 'breakout' | 'steady_riser'
  pAtSignal: numeric('p_at_signal', { precision: 10, scale: 2 }).notNull(),
  refPrice: numeric('ref_price', { precision: 10, scale: 2 }),
  dollarChange: numeric('dollar_change', { precision: 10, scale: 2 }),
  pctChange: numeric('pct_change', { precision: 7, scale: 2 }),
  rankInSignal: smallint('rank_in_signal'),
  extra: jsonb('extra'),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.asOfDate, table.signalType, table.printingId] }),
  printingIdx: index('idx_daily_movers_printing').on(table.printingId, table.asOfDate.desc()),
  recentIdx: index('idx_daily_movers_recent').on(table.asOfDate.desc(), table.signalType),
}));

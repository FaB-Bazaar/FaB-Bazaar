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
  boolean,
  integer,
  real,
  uniqueIndex,
  index,
  pgEnum,
  jsonb
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

  // MCP authentication
  mcpToken: text('mcp_token'),
  mcpTokenExpiry: timestamp('mcp_token_expiry'),
  clientHash: text('client_hash'),

  // Location
  countryCode: text('country_code'),

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
  isPatreon: boolean('is_patreon').default(false).notNull(),
  isShop: boolean('is_shop').default(false).notNull(),
  isTcgSeller: boolean('is_tcg_seller').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  discordIdIdx: index('idx_users_discord_id').on(table.discordId),
  usernameIdx: index('idx_users_username').on(table.username),
  emailHashIdx: index('idx_users_email_hash').on(table.emailHash),
  mcpTokenIdx: index('idx_users_mcp_token').on(table.mcpToken),
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

  // Card text & abilities
  text: text('text'),
  searchableText: text('searchable_text'),
  typeText: text('type_text'),
  typeTextDisplay: text('type_text_display'),

  // Arrays (PostgreSQL supports native arrays)
  types: text('types').array(),
  traits: text('traits').array(),
  keywords: text('keywords').array(),
  abilities: text('abilities').array(),
  classes: text('classes').array(),
  talents: text('talents').array(),

  // Game stats
  power: integer('power'),
  powerText: text('power_text'),
  cost: integer('cost'),
  costText: text('cost_text'),
  defense: integer('defense'),
  defenseText: text('defense_text'),
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

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('idx_cards_name').on(table.name),
  typeTextIdx: index('idx_cards_type_text').on(table.typeText),
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
  imageRotationDegrees: integer('image_rotation_degrees').default(0),
  artists: text('artists').array(),
  flavorText: text('flavor_text'),
  artVariations: text('art_variations').array(),

  // TCGPlayer integration
  tcgplayerProductId: text('tcgplayer_product_id'),
  tcgplayerUrl: text('tcgplayer_url'),
  tcgplayerSubtypeName: text('tcgplayer_subtype_name'),

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
  isPublic: boolean('is_public').default(false).notNull(),

  // Fabrary integration
  fabraryUrl: text('fabrary_url'),
  fabraryDeckId: text('fabrary_deck_id'),

  // Optional metadata
  tags: text('tags').array(),
  metadata: jsonb('metadata'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_decks_user_id').on(table.userId),
  publicIdIdx: index('idx_decks_public_id').on(table.publicId),
  isPublicIdx: index('idx_decks_public').on(table.isPublic).where(sql`${table.isPublic} = true`),
  uniqueUserName: uniqueIndex('unique_decks_user_name').on(table.userId, table.name),
  uniqueUserSlug: index('idx_decks_user_slug').on(table.userId, table.slug),
}));

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
// RELATIONS (for Drizzle queries)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
  binders: many(binders),
  inventoryItems: many(inventoryItems),
  wantsItems: many(wantsItems),
  decks: many(decks),
  oauthClients: many(oauthClients),
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
// SITE SETTINGS
// ============================================================================

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

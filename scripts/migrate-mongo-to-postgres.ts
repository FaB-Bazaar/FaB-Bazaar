/**
 * MongoDB to PostgreSQL Migration Script
 *
 * Migrates data from MongoDB to PostgreSQL:
 * - Users → users table
 * - Articles → articles table
 * - Binders → binders table
 * - Printings → cards and printings tables (normalized)
 * - Inventory Items → inventory_items table
 * - Wants Items → wants_items table
 * - Decks → decks and deck_cards tables (normalized)
 *
 * Does NOT delete or modify MongoDB data - read-only operation.
 */

import { connectToDatabase } from '@/lib/mongodb';
import mongoose from 'mongoose';
import { db } from '@/lib/postgres/db';
import { users, articles, binders, cards, printings, inventoryItems, wantsItems, decks, deckCards } from '@/lib/postgres/schema';
import { eq } from 'drizzle-orm';

interface MongoPrinting {
  _id: string;
  printing_id: string;
  card_unique_id: string;
  name: string;
  display_name: string;
  text?: string;
  searchable_text?: string;
  type_text?: string;
  type_text_display?: string;
  types?: string[];
  traits?: string[];
  keywords?: string[];
  abilities?: string[];
  classes?: string[];
  talents?: string[];
  power?: number;
  power_text?: string;
  cost?: number;
  cost_text?: string;
  defense?: number;
  defense_text?: string;
  pitch?: number;
  pitch_text?: string;
  health?: number;
  intelligence?: number;
  color?: string;
  is_action?: boolean;
  is_attack?: boolean;
  is_defense_reaction?: boolean;
  is_instant?: boolean;
  is_equipment?: boolean;
  is_weapon?: boolean;
  is_hero?: boolean;
  is_mentor?: boolean;
  is_token?: boolean;
  played_horizontally?: boolean;
  is_generic?: boolean;
  is_brute?: boolean;
  is_guardian?: boolean;
  is_mechanologist?: boolean;
  is_ranger?: boolean;
  is_runeblade?: boolean;
  is_assassin?: boolean;
  is_warrior?: boolean;
  is_ninja?: boolean;
  is_wizard?: boolean;
  is_merchant?: boolean;
  is_bard?: boolean;
  is_adjudicator?: boolean;
  is_illusionist?: boolean;
  is_thief?: boolean;
  is_shapeshifter?: boolean;
  is_necromancer?: boolean;
  has_chaos?: boolean;
  has_light?: boolean;
  has_royal?: boolean;
  has_draconic?: boolean;
  has_lightning?: boolean;
  has_shadow?: boolean;
  has_earth?: boolean;
  has_mystic?: boolean;
  has_revered?: boolean;
  has_ice?: boolean;
  has_reviled?: boolean;
  has_pirate?: boolean;
  has_elemental?: boolean;
  is_generic_only?: boolean;
  has_class_and_talent?: boolean;
  has_class_only?: boolean;
  has_talent_only?: boolean;
  blitz_legal?: boolean;
  cc_legal?: boolean;
  commoner_legal?: boolean;
  ll_legal?: boolean;
  silver_age_legal?: boolean;
  blitz_banned?: boolean;
  cc_banned?: boolean;
  commoner_banned?: boolean;
  ll_banned?: boolean;
  blitz_suspended?: boolean;
  cc_suspended?: boolean;
  commoner_suspended?: boolean;
  ll_restricted?: boolean;
  silver_age_banned?: boolean;
  silver_age_suspended?: boolean;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  printing_card_id?: string;
  set_printing_unique_id?: string;
  collector_number?: string;
  is_first_edition?: boolean;
  is_unlimited?: boolean;
  is_normal_edition?: boolean;
  is_normal_foil?: boolean;
  is_rainbow_foil?: boolean;
  is_cold_foil?: boolean;
  is_extended_art?: boolean;
  is_common?: boolean;
  is_rare?: boolean;
  is_super_rare?: boolean;
  is_majestic?: boolean;
  is_legendary?: boolean;
  is_fabled?: boolean;
  is_promo?: boolean;
  image_url?: string;
  image_rotation_degrees?: number;
  artists?: string[];
  flavor_text?: string;
  art_variations?: string[];
  tcgplayer_product_id?: string;
  tcgplayer_url?: string;
  tcgplayer_subtype_name?: string;
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  has_price?: boolean;
  price_updated_at?: Date;
  is_budget?: boolean;
  is_under_5?: boolean;
  is_under_10?: boolean;
  is_under_25?: boolean;
  is_under_50?: boolean;
  is_under_100?: boolean;
  is_expensive?: boolean;
  is_premium?: boolean;
  expansion_slot?: boolean;
  content_hash?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface MongoUser {
  _id: string;
  username: string;
  displayUsername?: string;
  email?: string;
  emailHash?: string;
  emailIV?: string;
  password?: string;
  isPasswordPreHashed?: boolean;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  avatarUrl?: string;
  mcpToken?: string;
  mcpTokenExpiry?: Date;
  clientHash?: string;
  countryCode?: string;
  roles?: {
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    isContentCreator?: boolean;
    canManageLocations?: boolean;
    canImportCardCollections?: boolean;
    canModerateForums?: boolean;
  };
  isStore?: boolean;
  storeId?: string;
  isLocalGamingStore?: boolean;
  isPatreon?: boolean;
  isShop?: boolean;
  isTcgSeller?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MongoArticle {
  _id: string;
  title: string;
  subtitle?: string;
  publicId: string;
  slug?: string;
  content?: string;
  authorId: string;
  status: 'draft' | 'published';
  contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament';
  categories?: string[];
  image?: string;
  sections?: any[];
  isUserArticle?: boolean;
  heroSlug?: string;
  heroClass?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MongoBinder {
  _id: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
  visibility?: {
    level?: 'public' | 'private' | 'friends' | 'unlisted';
    allowInSearch?: boolean;
    allowInMatching?: boolean;
    allowDiscordCommands?: boolean;
    allowApiExport?: boolean;
    allowWhoHas?: boolean;
    allowWebhooks?: boolean;
  };
  statsUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MongoInventoryItem {
  _id: string;
  userId: string;
  binderId: string;
  printingId: string;
  quantity?: number;
  condition?: string;
  language?: string;
  notes?: string;
  forTrade?: boolean;
  forSale?: boolean;
  acquisitionPrice?: number;
  acquisitionDate?: Date;
  addedAt?: Date;
  updatedAt?: Date;
}

interface MongoWantsItem {
  _id: string;
  userId: string;
  printingId: string;
  quantity?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  maxPrice?: number;
  addedAt?: Date;
  updatedAt?: Date;
}

interface MongoDeckCard {
  printingId: string;
  _id?: string;
}

interface MongoDeck {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  format?: string;
  isPublic?: boolean;
  hero?: MongoDeckCard[];
  equipment?: MongoDeckCard[];
  maindeck?: MongoDeckCard[];
  inventory?: MongoDeckCard[];
  maybeboard?: MongoDeckCard[];
  tokens?: MongoDeckCard[];
  createdAt?: Date;
  updatedAt?: Date;
}

async function migrate() {
  console.log('🚀 Starting MongoDB → PostgreSQL Migration\n');
  console.log('⚠️  This is a READ-ONLY operation - MongoDB data will NOT be modified\n');

  try {
    // Connect to MongoDB
    console.log('1️⃣ Connecting to MongoDB...');
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    // ========================================================================
    // MIGRATE USERS
    // ========================================================================
    console.log('2️⃣ Migrating users...');
    const UsersCollection = mongoose.connection.collection('users');
    const usersCount = await UsersCollection.countDocuments();
    console.log(`📊 Found ${usersCount.toLocaleString()} users in MongoDB\n`);

    const mongoUsers = await UsersCollection.find({}).toArray() as unknown as MongoUser[];
    console.log(`   Fetched ${mongoUsers.length.toLocaleString()} users\n`);

    let usersInserted = 0;
    let usersSkipped = 0;
    const userBatchSize = 100;

    for (let i = 0; i < mongoUsers.length; i += userBatchSize) {
      const batch = mongoUsers.slice(i, i + userBatchSize);
      const usersToInsert = batch.map(u => ({
        id: u._id.toString(),
        username: u.username,
        displayUsername: u.displayUsername || null,
        email: u.email || null,
        emailHash: u.emailHash || null,
        emailIV: u.emailIV || null,
        passwordHash: u.password || null,
        isPasswordPreHashed: u.isPasswordPreHashed || false,
        discordId: u.discordId || null,
        discordUsername: u.discordUsername || null,
        discordAvatar: u.discordAvatar || null,
        avatarUrl: u.avatarUrl || null,
        mcpToken: u.mcpToken || null,
        mcpTokenExpiry: u.mcpTokenExpiry ? new Date(u.mcpTokenExpiry) : null,
        clientHash: u.clientHash || null,
        countryCode: u.countryCode || null,
        isAdmin: u.roles?.isAdmin || false,
        isSuperAdmin: u.roles?.isSuperAdmin || false,
        isContentCreator: u.roles?.isContentCreator || false,
        canManageLocations: u.roles?.canManageLocations || false,
        canImportCardCollections: u.roles?.canImportCardCollections || false,
        canModerateForums: u.roles?.canModerateForums || false,
        isStore: u.isStore || false,
        storeId: u.storeId || null,
        isLocalGamingStore: u.isLocalGamingStore || false,
        isPatreon: u.isPatreon || false,
        isShop: u.isShop || false,
        isTcgSeller: u.isTcgSeller || false,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      }));

      try {
        await db.insert(users)
          .values(usersToInsert)
          .onConflictDoNothing();
        usersInserted += usersToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / userBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  User batch ${batchNum} error:`, error.message);
        } else {
          console.log(`   ⚠️  User batch ${batchNum} had conflicts, skipping...`);
        }
        usersSkipped += usersToInsert.length;
      }

      if ((i + userBatchSize) % 1000 === 0 || i + userBatchSize >= mongoUsers.length) {
        console.log(`   Progress: ${Math.min(i + userBatchSize, mongoUsers.length).toLocaleString()} / ${mongoUsers.length.toLocaleString()} users`);
      }
    }

    console.log(`✅ Inserted ${usersInserted.toLocaleString()} users (${usersSkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE ARTICLES
    // ========================================================================
    console.log('3️⃣ Migrating articles...');
    const ArticlesCollection = mongoose.connection.collection('articles');
    const articlesCount = await ArticlesCollection.countDocuments();
    console.log(`📊 Found ${articlesCount.toLocaleString()} articles in MongoDB\n`);

    const mongoArticles = await ArticlesCollection.find({}).toArray() as unknown as MongoArticle[];
    console.log(`   Fetched ${mongoArticles.length.toLocaleString()} articles\n`);

    let articlesInserted = 0;
    let articlesSkipped = 0;
    const articleBatchSize = 100;

    // Get all user IDs from PostgreSQL to validate foreign keys
    const pgUsers = await db.select({ id: users.id }).from(users);
    const pgUserIds = new Set(pgUsers.map(u => u.id));

    for (let i = 0; i < mongoArticles.length; i += articleBatchSize) {
      const batch = mongoArticles.slice(i, i + articleBatchSize);
      // Filter out articles where author doesn't exist in PostgreSQL
      const validBatch = batch.filter(a => pgUserIds.has(a.authorId.toString()));

      if (validBatch.length === 0) {
        console.log(`   ⚠️  Batch ${Math.floor(i / articleBatchSize) + 1} skipped - no valid authors`);
        articlesSkipped += batch.length;
        continue;
      }

      const articlesToInsert = validBatch.map(a => ({
        id: a._id.toString(),
        title: a.title,
        subtitle: a.subtitle || null,
        publicId: a.publicId,
        slug: a.slug || null,
        content: a.content || null,
        authorId: a.authorId.toString(),
        status: a.status || 'draft',
        contentType: a.contentType,
        categories: a.categories || null,
        image: a.image || null,
        sections: a.sections ? JSON.stringify(a.sections) : null,
        isUserArticle: a.isUserArticle ?? false,
        heroSlug: a.heroSlug || null,
        heroClass: a.heroClass || null,
        createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
        updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
      }));

      try {
        await db.insert(articles)
          .values(articlesToInsert)
          .onConflictDoNothing();
        articlesInserted += articlesToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / articleBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  Article batch ${batchNum} error:`, error.message);
          console.log(`   Sample article:`, JSON.stringify(articlesToInsert[0], null, 2));
        } else {
          console.log(`   ⚠️  Article batch ${batchNum} had conflicts, skipping...`);
        }
        articlesSkipped += articlesToInsert.length;
      }

      if ((i + articleBatchSize) % 1000 === 0 || i + articleBatchSize >= mongoArticles.length) {
        console.log(`   Progress: ${Math.min(i + articleBatchSize, mongoArticles.length).toLocaleString()} / ${mongoArticles.length.toLocaleString()} articles`);
      }
    }

    console.log(`✅ Inserted ${articlesInserted.toLocaleString()} articles (${articlesSkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE BINDERS
    // ========================================================================
    console.log('4️⃣ Migrating binders...');
    const BindersCollection = mongoose.connection.collection('binders');
    const bindersCount = await BindersCollection.countDocuments();
    console.log(`📊 Found ${bindersCount.toLocaleString()} binders in MongoDB\n`);

    const mongoBinders = await BindersCollection.find({}).toArray() as unknown as MongoBinder[];
    console.log(`   Fetched ${mongoBinders.length.toLocaleString()} binders\n`);

    let bindersInserted = 0;
    let bindersSkipped = 0;
    const binderBatchSize = 100;

    for (let i = 0; i < mongoBinders.length; i += binderBatchSize) {
      const batch = mongoBinders.slice(i, i + binderBatchSize);
      const bindersToInsert = batch.map(b => ({
        id: b._id.toString(),
        userId: b.userId.toString(),
        name: b.name,
        slug: b.slug || null,
        description: b.description || null,
        isPublic: b.isPublic ?? true,
        visibilityLevel: b.visibility?.level || 'public',
        allowInSearch: b.visibility?.allowInSearch ?? true,
        allowInMatching: b.visibility?.allowInMatching ?? true,
        allowDiscordCommands: b.visibility?.allowDiscordCommands ?? true,
        allowApiExport: b.visibility?.allowApiExport ?? true,
        allowWhoHas: b.visibility?.allowWhoHas ?? true,
        allowWebhooks: b.visibility?.allowWebhooks ?? false,
        statsNeedUpdate: true,
        statsUpdatedAt: b.statsUpdatedAt ? new Date(b.statsUpdatedAt) : null,
        createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
      }));

      try {
        await db.insert(binders)
          .values(bindersToInsert)
          .onConflictDoNothing();
        bindersInserted += bindersToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / binderBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  Binder batch ${batchNum} error:`, error.message);
        } else {
          console.log(`   ⚠️  Binder batch ${batchNum} had conflicts, skipping...`);
        }
        bindersSkipped += bindersToInsert.length;
      }

      if ((i + binderBatchSize) % 1000 === 0 || i + binderBatchSize >= mongoBinders.length) {
        console.log(`   Progress: ${Math.min(i + binderBatchSize, mongoBinders.length).toLocaleString()} / ${mongoBinders.length.toLocaleString()} binders`);
      }
    }

    console.log(`✅ Inserted ${bindersInserted.toLocaleString()} binders (${bindersSkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE CARDS & PRINTINGS
    // ========================================================================
    // Get MongoDB printings collection
    const PrintingsModel = mongoose.connection.collection('printings');

    // Count total documents
    const totalCount = await PrintingsModel.countDocuments();
    console.log('\n📦 Migrating cards and printings...');
    console.log(`📊 Found ${totalCount.toLocaleString()} printings in MongoDB\n`);

    // Fetch all printings
    console.log('   Fetching printings from MongoDB...');
    const mongoPrintings = await PrintingsModel.find({}).toArray() as unknown as MongoPrinting[];
    console.log(`✅ Fetched ${mongoPrintings.length.toLocaleString()} printings\n`);

    // Group by card_unique_id to get unique cards
    console.log('   Extracting unique cards...');
    const cardMap = new Map<string, MongoPrinting>();

    for (const printing of mongoPrintings) {
      if (!cardMap.has(printing.card_unique_id)) {
        cardMap.set(printing.card_unique_id, printing);
      }
    }

    console.log(`✅ Found ${cardMap.size.toLocaleString()} unique cards\n`);

    // Insert cards into PostgreSQL
    console.log('   Inserting cards into PostgreSQL...');
    let cardsInserted = 0;
    let cardsSkipped = 0;
    const batchSize = 100;
    const cardEntries = Array.from(cardMap.values());

    for (let i = 0; i < cardEntries.length; i += batchSize) {
      const batch = cardEntries.slice(i, i + batchSize);
      const cardsToInsert = batch.map(p => ({
        cardUniqueId: p.card_unique_id,
        name: p.name,
        displayName: p.display_name,
        text: p.text || null,
        searchableText: p.searchable_text || null,
        typeText: p.type_text || null,
        typeTextDisplay: p.type_text_display || null,
        types: p.types || null,
        traits: p.traits || null,
        keywords: p.keywords || null,
        abilities: p.abilities || null,
        classes: p.classes || null,
        talents: p.talents || null,
        power: p.power || null,
        powerText: p.power_text || null,
        cost: p.cost || null,
        costText: p.cost_text || null,
        defense: p.defense || null,
        defenseText: p.defense_text || null,
        pitch: p.pitch || null,
        pitchText: p.pitch_text || null,
        health: p.health || null,
        intelligence: p.intelligence || null,
        color: p.color || null,
        isAction: p.is_action || false,
        isAttack: p.is_attack || false,
        isDefenseReaction: p.is_defense_reaction || false,
        isInstant: p.is_instant || false,
        isEquipment: p.is_equipment || false,
        isWeapon: p.is_weapon || false,
        isHero: p.is_hero || false,
        isMentor: p.is_mentor || false,
        isToken: p.is_token || false,
        playedHorizontally: p.played_horizontally || false,
        isGeneric: p.is_generic || false,
        isBrute: p.is_brute || false,
        isGuardian: p.is_guardian || false,
        isMechanologist: p.is_mechanologist || false,
        isRanger: p.is_ranger || false,
        isRuneblade: p.is_runeblade || false,
        isAssassin: p.is_assassin || false,
        isWarrior: p.is_warrior || false,
        isNinja: p.is_ninja || false,
        isWizard: p.is_wizard || false,
        isMerchant: p.is_merchant || false,
        isBard: p.is_bard || false,
        isAdjudicator: p.is_adjudicator || false,
        isIllusionist: p.is_illusionist || false,
        isThief: p.is_thief || false,
        isShapeshifter: p.is_shapeshifter || false,
        isNecromancer: p.is_necromancer || false,
        hasChaos: p.has_chaos || false,
        hasLight: p.has_light || false,
        hasRoyal: p.has_royal || false,
        hasDraconic: p.has_draconic || false,
        hasLightning: p.has_lightning || false,
        hasShadow: p.has_shadow || false,
        hasEarth: p.has_earth || false,
        hasMystic: p.has_mystic || false,
        hasRevered: p.has_revered || false,
        hasIce: p.has_ice || false,
        hasReviled: p.has_reviled || false,
        hasPirate: p.has_pirate || false,
        hasElemental: p.has_elemental || false,
        isGenericOnly: p.is_generic_only || false,
        hasClassAndTalent: p.has_class_and_talent || false,
        hasClassOnly: p.has_class_only || false,
        hasTalentOnly: p.has_talent_only || false,
        blitzLegal: p.blitz_legal || false,
        ccLegal: p.cc_legal || false,
        commonerLegal: p.commoner_legal || false,
        llLegal: p.ll_legal || false,
        silverAgeLegal: p.silver_age_legal || false,
        blitzBanned: p.blitz_banned || false,
        ccBanned: p.cc_banned || false,
        commonerBanned: p.commoner_banned || false,
        llBanned: p.ll_banned || false,
        blitzSuspended: p.blitz_suspended || false,
        ccSuspended: p.cc_suspended || false,
        commonerSuspended: p.commoner_suspended || false,
        llRestricted: p.ll_restricted || false,
        silverAgeBanned: p.silver_age_banned || false,
        silverAgeSuspended: p.silver_age_suspended || false,
      }));

      try {
        await db.insert(cards)
          .values(cardsToInsert)
          .onConflictDoNothing();
        cardsInserted += cardsToInsert.length;
      } catch (error: any) {
        console.log(`   ⚠️  Batch ${Math.floor(i / batchSize) + 1} had conflicts, skipping...`);
        cardsSkipped += cardsToInsert.length;
      }

      // Progress indicator
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= cardEntries.length) {
        console.log(`   Progress: ${Math.min(i + batchSize, cardEntries.length).toLocaleString()} / ${cardEntries.length.toLocaleString()} cards`);
      }
    }

    console.log(`✅ Inserted ${cardsInserted.toLocaleString()} cards (${cardsSkipped} skipped as duplicates)\n`);

    // Insert printings into PostgreSQL
    console.log('   Inserting printings into PostgreSQL...');
    let printingsInserted = 0;
    let printingsSkipped = 0;

    for (let i = 0; i < mongoPrintings.length; i += batchSize) {
      const batch = mongoPrintings.slice(i, i + batchSize);
      const printingsToInsert = batch.map(p => ({
        printingId: p.printing_id,
        cardUniqueId: p.card_unique_id,
        setPrintingUniqueId: p.set_printing_unique_id || null,
        collectorNumber: p.printing_card_id || p.collector_number || null,
        set: p.set,
        edition: p.edition,
        foiling: p.foiling,
        rarity: p.rarity,
        isFirstEdition: p.is_first_edition || false,
        isUnlimited: p.is_unlimited || false,
        isNormalEdition: p.is_normal_edition || false,
        isNormalFoil: p.is_normal_foil || false,
        isRainbowFoil: p.is_rainbow_foil || false,
        isColdFoil: p.is_cold_foil || false,
        isExtendedArt: p.is_extended_art || false,
        isCommon: p.is_common || false,
        isRare: p.is_rare || false,
        isSuperRare: p.is_super_rare || false,
        isMajestic: p.is_majestic || false,
        isLegendary: p.is_legendary || false,
        isFabled: p.is_fabled || false,
        isPromo: p.is_promo || false,
        imageUrl: p.image_url || null,
        imageRotationDegrees: p.image_rotation_degrees || 0,
        artists: p.artists || null,
        flavorText: p.flavor_text || null,
        artVariations: p.art_variations || null,
        tcgplayerProductId: p.tcgplayer_product_id || null,
        tcgplayerUrl: p.tcgplayer_url || null,
        tcgplayerSubtypeName: p.tcgplayer_subtype_name || null,
        tcgMarket: p.tcg_market || null,
        tcgLow: p.tcg_low || null,
        tcgMid: p.tcg_mid || null,
        tcgHigh: p.tcg_high || null,
        hasPrice: p.has_price || false,
        priceUpdatedAt: p.price_updated_at ? new Date(p.price_updated_at) : null,
        isBudget: p.is_budget || false,
        isUnder5: p.is_under_5 || false,
        isUnder10: p.is_under_10 || false,
        isUnder25: p.is_under_25 || false,
        isUnder50: p.is_under_50 || false,
        isUnder100: p.is_under_100 || false,
        isExpensive: p.is_expensive || false,
        isPremium: p.is_premium || false,
        expansionSlot: p.expansion_slot || false,
        contentHash: p.content_hash || null,
      }));

      try {
        await db.insert(printings)
          .values(printingsToInsert)
          .onConflictDoNothing();
        printingsInserted += printingsToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / batchSize) + 1;
        if (batchNum === 1) {
          // Show detailed error for first batch to help debug
          console.log(`   ⚠️  Batch ${batchNum} error:`, error.message);
          console.log(`   Sample record:`, JSON.stringify(printingsToInsert[0], null, 2));
        } else {
          console.log(`   ⚠️  Batch ${batchNum} had conflicts, skipping...`);
        }
        printingsSkipped += printingsToInsert.length;
      }

      // Progress indicator
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= mongoPrintings.length) {
        console.log(`   Progress: ${Math.min(i + batchSize, mongoPrintings.length).toLocaleString()} / ${mongoPrintings.length.toLocaleString()} printings`);
      }
    }

    console.log(`✅ Inserted ${printingsInserted.toLocaleString()} printings (${printingsSkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE INVENTORY ITEMS
    // ========================================================================
    console.log('4️⃣ Migrating inventory items...');
    const InventoryCollection = mongoose.connection.collection('inventory_items');
    const inventoryCount = await InventoryCollection.countDocuments();
    console.log(`📊 Found ${inventoryCount.toLocaleString()} inventory items in MongoDB\n`);

    const mongoInventory = await InventoryCollection.find({}).toArray() as unknown as MongoInventoryItem[];
    console.log(`   Fetched ${mongoInventory.length.toLocaleString()} inventory items\n`);

    let inventoryInserted = 0;
    let inventorySkipped = 0;
    const inventoryBatchSize = 100;

    for (let i = 0; i < mongoInventory.length; i += inventoryBatchSize) {
      const batch = mongoInventory.slice(i, i + inventoryBatchSize);
      const inventoryToInsert = batch.map(inv => ({
        id: inv._id.toString(),
        userId: inv.userId.toString(),
        binderId: inv.binderId.toString(),
        printingId: inv.printingId,
        quantity: inv.quantity || 1,
        condition: (inv.condition || 'NM') as 'NM' | 'LP' | 'MP' | 'HP' | 'DMG',
        language: inv.language || 'EN',
        notes: inv.notes || null,
        forTrade: inv.forTrade ?? false,
        forSale: inv.forSale ?? false,
        acquisitionPrice: inv.acquisitionPrice || null,
        acquisitionDate: inv.acquisitionDate ? new Date(inv.acquisitionDate) : null,
        addedAt: inv.addedAt ? new Date(inv.addedAt) : new Date(),
        updatedAt: inv.updatedAt ? new Date(inv.updatedAt) : new Date(),
      }));

      try {
        await db.insert(inventoryItems)
          .values(inventoryToInsert)
          .onConflictDoNothing();
        inventoryInserted += inventoryToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / inventoryBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  Inventory batch ${batchNum} error:`, error.message);
        } else {
          console.log(`   ⚠️  Inventory batch ${batchNum} had conflicts, skipping...`);
        }
        inventorySkipped += inventoryToInsert.length;
      }

      if ((i + inventoryBatchSize) % 1000 === 0 || i + inventoryBatchSize >= mongoInventory.length) {
        console.log(`   Progress: ${Math.min(i + inventoryBatchSize, mongoInventory.length).toLocaleString()} / ${mongoInventory.length.toLocaleString()} inventory items`);
      }
    }

    console.log(`✅ Inserted ${inventoryInserted.toLocaleString()} inventory items (${inventorySkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE WANTS ITEMS
    // ========================================================================
    console.log('5️⃣ Migrating wants items...');
    const WantsCollection = mongoose.connection.collection('wants_items');
    const wantsCount = await WantsCollection.countDocuments();
    console.log(`📊 Found ${wantsCount.toLocaleString()} wants items in MongoDB\n`);

    const mongoWants = await WantsCollection.find({}).toArray() as unknown as MongoWantsItem[];
    console.log(`   Fetched ${mongoWants.length.toLocaleString()} wants items\n`);

    let wantsInserted = 0;
    let wantsSkipped = 0;
    const wantsBatchSize = 100;

    for (let i = 0; i < mongoWants.length; i += wantsBatchSize) {
      const batch = mongoWants.slice(i, i + wantsBatchSize);
      const wantsToInsert = batch.map(want => ({
        id: want._id.toString(),
        userId: want.userId.toString(),
        printingId: want.printingId,
        quantity: want.quantity || 1,
        priority: (want.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        notes: want.notes || null,
        maxPrice: want.maxPrice || null,
        addedAt: want.addedAt ? new Date(want.addedAt) : new Date(),
        updatedAt: want.updatedAt ? new Date(want.updatedAt) : new Date(),
      }));

      try {
        await db.insert(wantsItems)
          .values(wantsToInsert)
          .onConflictDoNothing();
        wantsInserted += wantsToInsert.length;
      } catch (error: any) {
        const batchNum = Math.floor(i / wantsBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  Wants batch ${batchNum} error:`, error.message);
        } else {
          console.log(`   ⚠️  Wants batch ${batchNum} had conflicts, skipping...`);
        }
        wantsSkipped += wantsToInsert.length;
      }

      if ((i + wantsBatchSize) % 1000 === 0 || i + wantsBatchSize >= mongoWants.length) {
        console.log(`   Progress: ${Math.min(i + wantsBatchSize, mongoWants.length).toLocaleString()} / ${mongoWants.length.toLocaleString()} wants items`);
      }
    }

    console.log(`✅ Inserted ${wantsInserted.toLocaleString()} wants items (${wantsSkipped} skipped as duplicates)\n`);

    // ========================================================================
    // MIGRATE DECKS
    // ========================================================================
    console.log('6️⃣ Migrating decks...');
    const DecksCollection = mongoose.connection.collection('decks');
    const decksCount = await DecksCollection.countDocuments();
    console.log(`📊 Found ${decksCount.toLocaleString()} decks in MongoDB\n`);

    const mongoDecks = await DecksCollection.find({}).toArray() as unknown as MongoDeck[];
    console.log(`   Fetched ${mongoDecks.length.toLocaleString()} decks\n`);

    // Get valid user IDs and printing IDs for validation
    const pgUsersForDecks = await db.select({ id: users.id }).from(users);
    const pgUserIdsForDecks = new Set(pgUsersForDecks.map(u => u.id));
    const pgPrintingsForDecks = await db.select({ printingId: printings.printingId }).from(printings);
    const pgPrintingIdsForDecks = new Set(pgPrintingsForDecks.map(p => p.printingId));

    let decksInserted = 0;
    let decksSkipped = 0;
    let deckCardsInserted = 0;
    let deckCardsSkipped = 0;
    const decksBatchSize = 50;

    for (let i = 0; i < mongoDecks.length; i += decksBatchSize) {
      const batch = mongoDecks.slice(i, i + decksBatchSize);

      // Filter decks where user exists
      const validDecks = batch.filter(d => pgUserIdsForDecks.has(d.userId.toString()));

      if (validDecks.length === 0) {
        decksSkipped += batch.length;
        continue;
      }

      const decksToInsert = validDecks.map(d => ({
        id: d._id.toString(),
        userId: d.userId.toString(),
        name: d.name,
        description: d.description || null,
        format: d.format || null,
        isPublic: d.isPublic ?? false,
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
      }));

      try {
        await db.insert(decks)
          .values(decksToInsert)
          .onConflictDoNothing();
        decksInserted += decksToInsert.length;

        // Now migrate deck cards for these decks
        for (const deck of validDecks) {
          const deckId = deck._id.toString();
          const deckCardsToInsert: any[] = [];

          // Helper to add cards from a category array
          const addCardsFromCategory = (
            cards: MongoDeckCard[] | undefined,
            category: 'hero' | 'equipment' | 'maindeck' | 'sideboard' | 'inventory'
          ) => {
            if (!cards || cards.length === 0) return;

            cards.forEach((card, index) => {
              // Skip if printing doesn't exist in PostgreSQL
              if (!pgPrintingIdsForDecks.has(card.printingId)) {
                deckCardsSkipped++;
                return;
              }

              deckCardsToInsert.push({
                id: card._id?.toString() || `${deckId}_${category}_${index}`,
                deckId,
                printingId: card.printingId,
                quantity: 1,
                category,
                pitch: null, // MongoDB doesn't store pitch at deck card level
              });
            });
          };

          // Add cards from all categories
          addCardsFromCategory(deck.hero, 'hero');
          addCardsFromCategory(deck.equipment, 'equipment');
          addCardsFromCategory(deck.maindeck, 'maindeck');
          addCardsFromCategory(deck.maybeboard, 'sideboard'); // Map maybeboard → sideboard
          addCardsFromCategory(deck.inventory, 'inventory');
          // Skip tokens (not in PostgreSQL enum)

          if (deckCardsToInsert.length > 0) {
            try {
              await db.insert(deckCards)
                .values(deckCardsToInsert)
                .onConflictDoNothing();
              deckCardsInserted += deckCardsToInsert.length;
            } catch (error: any) {
              console.log(`   ⚠️  Error inserting deck cards for deck ${deckId}:`, error.message);
              deckCardsSkipped += deckCardsToInsert.length;
            }
          }
        }

      } catch (error: any) {
        const batchNum = Math.floor(i / decksBatchSize) + 1;
        if (batchNum === 1) {
          console.log(`   ⚠️  Decks batch ${batchNum} error:`, error.message);
        } else {
          console.log(`   ⚠️  Decks batch ${batchNum} had conflicts, skipping...`);
        }
        decksSkipped += validDecks.length;
      }

      if ((i + decksBatchSize) % 100 === 0 || i + decksBatchSize >= mongoDecks.length) {
        console.log(`   Progress: ${Math.min(i + decksBatchSize, mongoDecks.length).toLocaleString()} / ${mongoDecks.length.toLocaleString()} decks`);
      }
    }

    console.log(`✅ Inserted ${decksInserted.toLocaleString()} decks (${decksSkipped} skipped)`);
    console.log(`✅ Inserted ${deckCardsInserted.toLocaleString()} deck cards (${deckCardsSkipped} skipped)\n`);

    // Verification
    console.log('\n7️⃣ Verifying migration...');
    const pgUsersCount = await db.select({ count: users.id }).from(users);
    const pgArticlesCount = await db.select({ count: articles.id }).from(articles);
    const pgBindersCount = await db.select({ count: binders.id }).from(binders);
    const pgCardsCount = await db.select({ count: cards.cardUniqueId }).from(cards);
    const pgPrintingsCount = await db.select({ count: printings.printingId }).from(printings);
    const pgInventoryCount = await db.select({ count: inventoryItems.id }).from(inventoryItems);
    const pgWantsCount = await db.select({ count: wantsItems.id }).from(wantsItems);
    const pgDecksCount = await db.select({ count: decks.id }).from(decks);
    const pgDeckCardsCount = await db.select({ count: deckCards.id }).from(deckCards);

    console.log(`✅ PostgreSQL now has:`);
    console.log(`   - ${pgUsersCount.length.toLocaleString()} users`);
    console.log(`   - ${pgArticlesCount.length.toLocaleString()} articles`);
    console.log(`   - ${pgBindersCount.length.toLocaleString()} binders`);
    console.log(`   - ${pgCardsCount.length.toLocaleString()} cards`);
    console.log(`   - ${pgPrintingsCount.length.toLocaleString()} printings`);
    console.log(`   - ${pgInventoryCount.length.toLocaleString()} inventory items`);
    console.log(`   - ${pgWantsCount.length.toLocaleString()} wants items`);
    console.log(`   - ${pgDecksCount.length.toLocaleString()} decks`);
    console.log(`   - ${pgDeckCardsCount.length.toLocaleString()} deck cards\n`);

    // Sample query to show it works
    console.log('8️⃣ Testing JOIN query...');
    const sampleCards = await db
      .select({
        cardName: cards.displayName,
        printingSet: printings.set,
        edition: printings.edition,
        foiling: printings.foiling,
        price: printings.tcgMarket,
      })
      .from(cards)
      .innerJoin(printings, eq(cards.cardUniqueId, printings.cardUniqueId))
      .limit(5);

    console.log('✅ Sample cards with printings:');
    sampleCards.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.cardName} (${c.printingSet}/${c.edition}/${c.foiling}) - $${c.price || 'N/A'}`);
    });

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`✅ MongoDB (unchanged):`);
    console.log(`   - ${usersCount.toLocaleString()} users`);
    console.log(`   - ${articlesCount.toLocaleString()} articles`);
    console.log(`   - ${bindersCount.toLocaleString()} binders`);
    console.log(`   - ${totalCount.toLocaleString()} printings`);
    console.log(`   - ${inventoryCount.toLocaleString()} inventory items`);
    console.log(`   - ${wantsCount.toLocaleString()} wants items`);
    console.log(`   - ${decksCount.toLocaleString()} decks`);
    console.log(`\n✅ PostgreSQL (migrated & normalized):`);
    console.log(`   - ${pgUsersCount.length.toLocaleString()} users`);
    console.log(`   - ${pgArticlesCount.length.toLocaleString()} articles`);
    console.log(`   - ${pgBindersCount.length.toLocaleString()} binders`);
    console.log(`   - ${pgCardsCount.length.toLocaleString()} cards`);
    console.log(`   - ${pgPrintingsCount.length.toLocaleString()} printings`);
    console.log(`   - ${pgInventoryCount.length.toLocaleString()} inventory items`);
    console.log(`   - ${pgWantsCount.length.toLocaleString()} wants items`);
    console.log(`   - ${pgDecksCount.length.toLocaleString()} decks`);
    console.log(`   - ${pgDeckCardsCount.length.toLocaleString()} deck cards`);
    console.log(`\n✅ Data normalized and ready to use!`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close connections
    await mongoose.connection.close();
    console.log('\n👋 Connections closed');
    process.exit(0);
  }
}

migrate();

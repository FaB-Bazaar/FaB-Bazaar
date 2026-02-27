import mongoose, { Document, Schema } from 'mongoose';

// Interface unchanged - only schema indexes are being optimized
export interface IInventoryItem extends Document {
  // === CORE USER-SPECIFIC FIELDS ===
  userId: mongoose.Types.ObjectId;
  binderId: mongoose.Types.ObjectId;
  printingId: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string;
  forTrade: boolean;
  forSale: boolean;
  
  // === ACQUISITION & COST FIELDS ===
  acquisitionPrice: number;
  acquisitionDate: Date;

  // === TIMESTAMPS ===
  addedAt: Date;
  updatedAt: Date;

  // === DENORMALIZED USER FIELDS ===
  discordUsername: string;
  discordId: string;
  avatarUrl?: string;
  userIsStore?: boolean;
  userStoreId?: mongoose.Types.ObjectId;

  // === DENORMALIZED BINDER FIELDS ===
  binderName: string;
  binderSlug?: string;
  binderIsPublic: boolean;
  binderAllowWhoHas: boolean;
  binderAllowInSearch: boolean;
  binderAllowInMatching: boolean;
  binderAllowDiscordCommands: boolean;
  binderAllowApiExport: boolean;
  binderAllowWebhooks: boolean;

  // === DENORMALIZED FIELDS FROM printings_core ===
  card_unique_id: string;
  name: string;
  display_name: string;
  collector_number: string;
  
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  
  type_text: string;
  type_text_display: string;
  
  image_url: string;
  
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  has_price: boolean;
  price_updated_at?: Date;
  
  tcgplayer_url: string;
  
  printingCreatedAt: Date;
  printingUpdatedAt: Date;

  [key: string]: any;
}

const InventoryItemSchema = new Schema<IInventoryItem>({
  // === CORE INVENTORY FIELDS ===
  // REMOVED: index: true from userId, binderId, printingId (covered by compound indexes)
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  binderId: { type: Schema.Types.ObjectId, ref: 'Binder', required: true },
  printingId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  condition: { type: String, default: 'NM' }, // REMOVED index
  language: { type: String, default: 'EN' },
  notes: { type: String, default: '' },
  forTrade: { type: Boolean, default: false }, // REMOVED index
  forSale: { type: Boolean, default: false },

  // === ACQUISITION FIELDS ===
  acquisitionPrice: { type: Number, default: null },
  acquisitionDate: { type: Date, default: null },

  // === DENORMALIZED USER FIELDS ===
  // REMOVED: index from discordUsername, userIsStore, userStoreId
  discordUsername: { type: String, required: true },
  discordId: { type: String, required: true },
  avatarUrl: { type: String },
  userIsStore: { type: Boolean, default: false },
  userStoreId: { type: Schema.Types.ObjectId, ref: 'Location' },

  // === DENORMALIZED BINDER FIELDS ===
  // REMOVED: index from all boolean permission fields
  binderName: { type: String, required: true },
  binderSlug: { type: String },
  binderIsPublic: { type: Boolean, required: true },
  binderAllowWhoHas: { type: Boolean, default: false },
  binderAllowInSearch: { type: Boolean, default: false },
  binderAllowInMatching: { type: Boolean, default: false },
  binderAllowDiscordCommands: { type: Boolean, default: false },
  binderAllowApiExport: { type: Boolean, default: false },
  binderAllowWebhooks: { type: Boolean, default: false },

  // === CORE CARD IDENTIFICATION ===
  // REMOVED: index from card_unique_id, display_name (covered by compound)
  card_unique_id: { type: String },
  name: { type: String },
  display_name: { type: String, required: true },
  collector_number: { type: String },

  // === PRINTING DETAILS ===
  // REMOVED: index from set, foiling, rarity (covered by compound)
  set: { type: String },
  edition: { type: String },
  foiling: { type: String },
  rarity: { type: String },
  is_extended_art: { type: Boolean, default: false },

  // === TYPE AND DISPLAY ===
  type_text: { type: String },
  type_text_display: { type: String },

  // === IMAGE ===
  image_url: { type: String },

  // === PRICING FIELDS ===
  // REMOVED: index from tcg_market, tcg_low (covered by compound)
  tcg_market: { type: Number, default: null },
  tcg_low: { type: Number, default: null },
  tcg_mid: { type: Number, default: null },
  tcg_high: { type: Number, default: null },
  has_price: { type: Boolean, default: false },
  price_updated_at: { type: Date },

  // === TCGPLAYER ===
  tcgplayer_url: { type: String },

  // === PRINTINGS_CORE TIMESTAMPS ===
  printingCreatedAt: { type: Date },
  printingUpdatedAt: { type: Date },

}, {
  timestamps: { createdAt: 'addedAt', updatedAt: 'updatedAt' },
  collection: 'inventory_items',
  strict: false
});

// === OPTIMIZED COMPOUND INDEXES ===

// Data integrity - ensure one printing per binder
InventoryItemSchema.index({ binderId: 1, printingId: 1 }, { unique: true });

// Performance indexes for common binder queries
InventoryItemSchema.index({ binderId: 1, addedAt: -1 }); // Default sort (newest first)
InventoryItemSchema.index({ binderId: 1, display_name: 1 }); // Sort by name
InventoryItemSchema.index({ binderId: 1, tcg_market: -1 }); // Sort by market price
InventoryItemSchema.index({ binderId: 1, tcg_low: -1 }); // Sort by low price
InventoryItemSchema.index({ binderId: 1, quantity: -1 }); // Sort by quantity

// Filter indexes for common UI filters
InventoryItemSchema.index({ binderId: 1, set: 1 });
InventoryItemSchema.index({ binderId: 1, rarity: 1 });
InventoryItemSchema.index({ binderId: 1, foiling: 1 });
InventoryItemSchema.index({ binderId: 1, forTrade: 1 });
InventoryItemSchema.index({ binderId: 1, condition: 1 });

// Cross-binder indexes for advanced queries
InventoryItemSchema.index({ userId: 1, forTrade: 1 }); // User's for-trade items

// === VISIBILITY-BASED INDEXES (OPTIMIZED) ===

// WhoHas queries - keep the core ones
// commenting this one out b/c it's part of a compound index
// InventoryItemSchema.index({ printingId: 1, binderAllowWhoHas: 1 }); 

// commenting this one out b/c it's part of a compound index
// InventoryItemSchema.index({ card_unique_id: 1, binderAllowWhoHas: 1 }); 
InventoryItemSchema.index({ printingId: 1, forTrade: 1, binderAllowWhoHas: 1 }); 

// Search queries
InventoryItemSchema.index({ printingId: 1, binderAllowInSearch: 1 });
InventoryItemSchema.index({ card_unique_id: 1, binderAllowInSearch: 1 });

// Matching queries
InventoryItemSchema.index({ printingId: 1, binderAllowInMatching: 1 });
InventoryItemSchema.index({ card_unique_id: 1, binderAllowInMatching: 1 });

// Webhook queries
InventoryItemSchema.index({ printingId: 1, binderAllowWebhooks: 1 });

const InventoryItem = mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);

export default InventoryItem;

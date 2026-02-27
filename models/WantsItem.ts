import mongoose, { Schema, type Document } from "mongoose"

export interface IWantsItem extends Document {
  // === CORE USER-SPECIFIC FIELDS ===
  userId: mongoose.Types.ObjectId
  printingId: string
  card_unique_id: string
  quantity: number
  priority: "high" | "medium" | "low"
  notes: string
  value: string
  isTemporary: boolean
  isPublic: boolean

  // === USER ORGANIZATION ===
  tags: string[] // NEW: Array of strings for user organization and filtering

  // === CONDITION & LANGUAGE ===
  condition: string
  language: string

  // === TRADE/SALE FLAGS ===
  forTrade: boolean
  forSale: boolean

  // === DENORMALIZED USER FIELDS ===
  discordUsername: string
  discordId: string
  userCountry?: string
  userState?: string

  // === DENORMALIZED CARD FIELDS ===
  display_name: string
  name: string
  set?: string
  edition?: string
  foiling?: string
  rarity?: string
  collector_number?: string
  color?: string
  type_text?: string
  type_text_display?: string
  is_extended_art?: boolean
  image_url?: string
  tcgplayer_url?: string

  // === PRICING FIELDS ===
  tcg_low?: number
  tcg_mid?: number
  tcg_high?: number
  tcg_market?: number
  has_price?: boolean
  price_updated_at?: Date

  // === ADDITIONAL TIMESTAMPS ===
  printingCreatedAt?: Date
  printingUpdatedAt?: Date
  addedAt?: Date
  createdAt: Date
  updatedAt: Date

  // Allow additional fields to be added dynamically
  [key: string]: any
}

const WantsItemSchema = new Schema<IWantsItem>(
  {
    // === CORE FIELDS ===
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    printingId: {
      type: String,
      required: true,
      index: true,
    },
    card_unique_id: {
      type: String,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    notes: {
      type: String,
      default: "",
    },
    value: {
      type: String,
      default: "",
    },
    isTemporary: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
      // NOTE: Wants lists are always public. This field is deprecated but kept for backward compatibility.
      // It defaults to true and should not be used for privacy filtering.
    },

    // === USER ORGANIZATION ===
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // === CONDITION & LANGUAGE ===
    condition: {
      type: String,
      default: "NM",
    },
    language: {
      type: String,
      default: "EN",
    },

    // === TRADE/SALE FLAGS ===
    forTrade: {
      type: Boolean,
      default: false,
    },
    forSale: {
      type: Boolean,
      default: false,
    },

    // === DENORMALIZED USER FIELDS ===
    discordUsername: {
      type: String,
      required: true,
    },
    discordId: {
      type: String,
      required: true,
    },
    userCountry: {
      type: String,
    },
    userState: {
      type: String,
    },

    // === DENORMALIZED CARD FIELDS ===
    display_name: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    set: {
      type: String,
    },
    edition: {
      type: String,
    },
    foiling: {
      type: String,
    },
    rarity: {
      type: String,
    },
    collector_number: {
      type: String,
    },
    color: {
      type: String,
    },
    type_text: {
      type: String,
    },
    type_text_display: {
      type: String,
    },
    is_extended_art: {
      type: Boolean,
      default: false,
    },
    image_url: {
      type: String,
    },
    tcgplayer_url: {
      type: String,
    },

    // === PRICING FIELDS ===
    tcg_low: {
      type: Number,
    },
    tcg_mid: {
      type: Number,
    },
    tcg_high: {
      type: Number,
    },
    tcg_market: {
      type: Number,
    },
    has_price: {
      type: Boolean,
      default: false,
    },
    price_updated_at: {
      type: Date,
    },

    // === ADDITIONAL TIMESTAMPS ===
    printingCreatedAt: {
      type: Date,
    },
    printingUpdatedAt: {
      type: Date,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "wants_items",
    strict: false, // Allow additional fields to be added dynamically
  }
)

// === OPTIMIZED COMPOUND INDEXES ===

// Data integrity - ensure one printing per user
WantsItemSchema.index({ userId: 1, printingId: 1 }, { unique: true })

// Performance indexes for common user queries
WantsItemSchema.index({ userId: 1, createdAt: -1 }) // User's wants, newest first
WantsItemSchema.index({ userId: 1, priority: 1 }) // User's wants by priority
WantsItemSchema.index({ userId: 1, isPublic: 1 }) // User's public wants
WantsItemSchema.index({ userId: 1, tags: 1 }) // User's wants by tag

// Cross-user indexes for "who wants" queries
WantsItemSchema.index({ printingId: 1, isPublic: 1 }) // Who wants this specific printing
WantsItemSchema.index({ card_unique_id: 1, isPublic: 1 }) // Who wants any printing of this card

// Public wants discovery
WantsItemSchema.index({ isPublic: 1, createdAt: -1 }) // Recent public wants
WantsItemSchema.index({ isPublic: 1, priority: 1 }) // High priority public wants

// Trade/sale filtering
WantsItemSchema.index({ forTrade: 1, isPublic: 1 }) // Public wants for trade
WantsItemSchema.index({ forSale: 1, isPublic: 1 }) // Public wants for sale

// Create the model if it doesn't exist, otherwise use the existing one
export const WantsItem =
  mongoose.models.WantsItem ||
  mongoose.model<IWantsItem>("WantsItem", WantsItemSchema)

export default WantsItem

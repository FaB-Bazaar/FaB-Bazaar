// models/printing.ts
import mongoose, { Schema, type Document } from "mongoose"

export interface IPrinting extends Document {
  // MongoDB & System IDs
  _id: mongoose.Types.ObjectId
  card_unique_id: string
  printing_id: string
  printing_card_id: string
  set_printing_unique_id: string

  // Card Information
  name: string
  display_name: string
  text?: string
  type_text?: string

  // Game Statistics
  power?: number
  cost?: number
  defense?: number
  pitch?: number
  health?: number
  intelligence?: number
  color?: string

  // Text Versions
  power_text?: string
  cost_text?: string
  defense_text?: string
  pitch_text?: string

  // Classes & Talents System - UPDATED
  types: string[]           // Still contains card types like ["elemental", "guardian", "hero"]
  classes: string[]         // NEW: Separated classes like ["guardian", "necromancer"]
  talents: string[]         // NEW: Separated talents like ["elemental", "pirate"]

  // Class Boolean Flags
  is_generic: boolean
  is_brute: boolean
  is_guardian: boolean
  is_mechanologist: boolean
  is_ranger: boolean
  is_runeblade: boolean
  is_assassin: boolean
  is_warrior: boolean
  is_ninja: boolean
  is_wizard: boolean
  is_merchant: boolean
  is_bard: boolean
  is_adjudicator: boolean
  is_illusionist: boolean
  is_thief: boolean
  is_shapeshifter: boolean
  is_necromancer: boolean

  // Talent Boolean Flags - UPDATED with essence system
  has_chaos: boolean
  has_light: boolean        // Light essence
  has_royal: boolean
  has_draconic: boolean
  has_lightning: boolean    // Lightning essence
  has_shadow: boolean       // Shadow essence
  has_earth: boolean        // Earth essence
  has_mystic: boolean
  has_revered: boolean
  has_ice: boolean          // Ice essence
  has_reviled: boolean
  has_pirate: boolean
  has_elemental: boolean    // Elemental talent

  // Combination Flags - NEW
  is_generic_only: boolean        // Generic cards (all heroes can play)
  has_class_and_talent: boolean   // e.g., "pirate necromancer" or "elemental guardian"
  has_class_only: boolean         // e.g., just "necromancer"
  has_talent_only: boolean        // e.g., just "pirate" or just "elemental"

  // Card Type Flags
  is_action: boolean
  is_attack: boolean
  is_defense_reaction: boolean
  is_instant: boolean
  is_equipment: boolean
  is_weapon: boolean
  is_hero: boolean
  is_mentor: boolean
  is_token: boolean

  // Printing-Specific Attributes
  set: string
  edition: string
  foiling: string
  rarity: string
  artists: string[]
  

  // Edition Flags
  is_first_edition: boolean
  is_unlimited: boolean
  is_normal_edition: boolean

  // Foiling Flags
  is_normal_foil: boolean
  is_rainbow_foil: boolean
  is_cold_foil: boolean
  is_extended_art: boolean

  // Rarity Flags
  is_common: boolean
  is_rare: boolean
  is_super_rare: boolean
  is_majestic: boolean
  is_legendary: boolean
  is_fabled: boolean
  is_promo: boolean

  // Pricing Data
  tcg_low?: number
  tcg_mid?: number
  tcg_high?: number
  tcg_market?: number

  // Price Category Flags
  is_budget: boolean        // < $1
  is_under_5: boolean       // < $5
  is_under_10: boolean      // < $10
  is_under_25: boolean      // < $25
  is_under_50: boolean      // < $50
  is_under_100: boolean     // < $100
  is_expensive: boolean     // > $100
  is_premium: boolean       // > $500

  // TCGPlayer Integration
  tcgplayer_product_id?: string
  tcgplayer_url?: string
  tcgplayer_subtype_name?: string

  // Format Legality
  blitz_legal: boolean
  cc_legal: boolean         // Classic Constructed
  commoner_legal: boolean
  ll_legal: boolean         // Living Legend
  silver_age_legal: boolean // Silver Age

  // Banned/Suspended Flags
  blitz_banned: boolean
  cc_banned: boolean
  commoner_banned: boolean
  ll_banned: boolean
  blitz_suspended: boolean
  cc_suspended: boolean
  commoner_suspended: boolean
  ll_restricted: boolean
  silver_age_banned: boolean
  silver_age_suspended: boolean

  // Search & Metadata
  searchable_text: string
  traits: string[]
  keywords: string[]
  abilities: string[]

  // Visual Data
  image_url: string
  image_rotation_degrees?: number
  flavor_text?: string
  art_variations: string[]
  played_horizontally: boolean

  // System Fields
  expansion_slot: boolean
  content_hash: string
  created_at: Date
  updated_at: Date
  price_updated_at?: Date
  printing_data?: any       // Original raw printing data
}

const PrintingSchema = new Schema<IPrinting>({
  // MongoDB & System IDs - KEEP THESE INDEXES (critical for lookups)
  card_unique_id: { type: String, required: true, index: true },
  printing_id: { type: String, required: true, index: true },
  printing_card_id: { type: String, required: true, index: true },
  set_printing_unique_id: { type: String, required: true, index: true },

  // Card Information - KEEP name index (used for search)
  name: { type: String, required: true, index: true },
  display_name: { type: String, required: true },
  text: String,
  type_text: String,

  // Game Statistics
  power: Number,
  cost: Number,
  defense: Number,
  pitch: Number,
  health: Number,
  intelligence: Number,
  color: { type: String, enum: ['red', 'yellow', 'blue', ''], default: '' },

  // Text Versions
  power_text: String,
  cost_text: String,
  defense_text: String,
  pitch_text: String,

  // Classes & Talents System - UPDATED
  types: { type: [String], default: [] },
  classes: { type: [String], default: [] },      // NEW: Separated classes
  talents: { type: [String], default: [] },      // NEW: Separated talents

  // Class Boolean Flags - NO INDEXES (can query using classes array)
  is_generic: { type: Boolean, default: false },
  is_brute: { type: Boolean, default: false },
  is_guardian: { type: Boolean, default: false },
  is_mechanologist: { type: Boolean, default: false },
  is_ranger: { type: Boolean, default: false },
  is_runeblade: { type: Boolean, default: false },
  is_assassin: { type: Boolean, default: false },
  is_warrior: { type: Boolean, default: false },
  is_ninja: { type: Boolean, default: false },
  is_wizard: { type: Boolean, default: false },
  is_merchant: { type: Boolean, default: false },
  is_bard: { type: Boolean, default: false },
  is_adjudicator: { type: Boolean, default: false },
  is_illusionist: { type: Boolean, default: false },
  is_thief: { type: Boolean, default: false },
  is_shapeshifter: { type: Boolean, default: false },
  is_necromancer: { type: Boolean, default: false },

  // Talent Boolean Flags - NO INDEXES (can query using talents array)
  has_chaos: { type: Boolean, default: false },
  has_light: { type: Boolean, default: false },
  has_royal: { type: Boolean, default: false },
  has_draconic: { type: Boolean, default: false },
  has_lightning: { type: Boolean, default: false },
  has_shadow: { type: Boolean, default: false },
  has_earth: { type: Boolean, default: false },
  has_mystic: { type: Boolean, default: false },
  has_revered: { type: Boolean, default: false },
  has_ice: { type: Boolean, default: false },
  has_reviled: { type: Boolean, default: false },
  has_pirate: { type: Boolean, default: false },
  has_elemental: { type: Boolean, default: false },

  // Combination Flags - NO INDEXES
  is_generic_only: { type: Boolean, default: false },
  has_class_and_talent: { type: Boolean, default: false },
  has_class_only: { type: Boolean, default: false },
  has_talent_only: { type: Boolean, default: false },

  // Card Type Flags - NO INDEXES (can query using types array)
  is_action: { type: Boolean, default: false },
  is_attack: { type: Boolean, default: false },
  is_defense_reaction: { type: Boolean, default: false },
  is_instant: { type: Boolean, default: false },
  is_equipment: { type: Boolean, default: false },
  is_weapon: { type: Boolean, default: false },
  is_hero: { type: Boolean, default: false },
  is_mentor: { type: Boolean, default: false },
  is_token: { type: Boolean, default: false },

  // Printing-Specific Attributes - KEEP THESE INDEXES (commonly filtered)
  set: { type: String, required: true, index: false },
  edition: { type: String, required: true, index: true },
  foiling: { type: String, required: true, index: true },
  rarity: { type: String, required: true, index: true },
  artists: { type: [String], default: [] },

  // Edition Flags - NO INDEXES (use edition field instead)
  is_first_edition: { type: Boolean, default: false },
  is_unlimited: { type: Boolean, default: false },
  is_normal_edition: { type: Boolean, default: false },

  // Foiling Flags - NO INDEXES (use foiling field instead)
  is_normal_foil: { type: Boolean, default: false },
  is_rainbow_foil: { type: Boolean, default: false },
  is_cold_foil: { type: Boolean, default: false },
  is_extended_art: { type: Boolean, default: false },

  // Rarity Flags - NO INDEXES (use rarity field instead)
  is_common: { type: Boolean, default: false },
  is_rare: { type: Boolean, default: false },
  is_super_rare: { type: Boolean, default: false },
  is_majestic: { type: Boolean, default: false },
  is_legendary: { type: Boolean, default: false },
  is_fabled: { type: Boolean, default: false },
  is_promo: { type: Boolean, default: false },

  // Pricing Data
  tcg_low: Number,
  tcg_mid: Number,
  tcg_high: Number,
  tcg_market: Number,

  // Price Category Flags - NO INDEXES
  is_budget: { type: Boolean, default: false },
  is_under_5: { type: Boolean, default: false },
  is_under_10: { type: Boolean, default: false },
  is_under_25: { type: Boolean, default: false },
  is_under_50: { type: Boolean, default: false },
  is_under_100: { type: Boolean, default: false },
  is_expensive: { type: Boolean, default: false },
  is_premium: { type: Boolean, default: false },

  // TCGPlayer Integration
  tcgplayer_product_id: String,
  tcgplayer_url: String,
  tcgplayer_subtype_name: String,

  // Format Legality - NO INDEXES
  blitz_legal: { type: Boolean, default: false },
  cc_legal: { type: Boolean, default: false },
  commoner_legal: { type: Boolean, default: false },
  ll_legal: { type: Boolean, default: false },
  silver_age_legal: { type: Boolean, default: false },

  // Banned/Suspended Flags - NO INDEXES
  blitz_banned: { type: Boolean, default: false },
  cc_banned: { type: Boolean, default: false },
  commoner_banned: { type: Boolean, default: false },
  ll_banned: { type: Boolean, default: false },
  blitz_suspended: { type: Boolean, default: false },
  cc_suspended: { type: Boolean, default: false },
  commoner_suspended: { type: Boolean, default: false },
  ll_restricted: { type: Boolean, default: false },
  silver_age_banned: { type: Boolean, default: false },
  silver_age_suspended: { type: Boolean, default: false },

  // Search & Metadata
  searchable_text: { type: String, required: true },
  traits: { type: [String], default: [] },
  keywords: { type: [String], default: [] },
  abilities: { type: [String], default: [] },

  // Visual Data
  image_url: { type: String, required: true },
  image_rotation_degrees: Number,
  flavor_text: String,
  art_variations: { type: [String], default: [] },
  played_horizontally: { type: Boolean, default: false },

  // System Fields
  expansion_slot: { type: Boolean, default: false },
  content_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  price_updated_at: Date,
  printing_data: Schema.Types.Mixed
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

// Compound index for common set/rarity queries (KEEP THIS)
PrintingSchema.index({ set: 1, rarity: 1 })

// Index on types array for card type filtering (KEEP THIS - replaces boolean indexes)
PrintingSchema.index({ types: 1 })

// Optional: Add compound indexes only if your queries actually need them
// PrintingSchema.index({ set: 1, foiling: 1, rarity: 1 })  // For set + foiling + rarity
// PrintingSchema.index({ classes: 1 })  // For class filtering
// PrintingSchema.index({ talents: 1 })  // For talent filtering

export const Printing = mongoose.models.Printing || mongoose.model<IPrinting>("Printing", PrintingSchema)
export default Printing
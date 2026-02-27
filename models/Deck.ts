// models/Deck.ts - Restructured deck model with nested arrays for better organization

import mongoose, { Schema, type Document } from "mongoose"
import { nanoid } from "nanoid"

export interface DeckPrinting {
  printingId: string  // References printing_id from Printing collection
  condition?: string  // "NM", "LP", "MP", "HP", "DMG" - deck-specific condition
  notes?: string      // Personal notes about this printing in the deck
  addedAt?: Date      // When this printing was added to the deck
  printingDetails?: any // Full printing data from the printings collection
  // No category field needed - implicit from parent array
}

export interface IDeck extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  publicId: string  // Globally unique, URL-safe identifier for external use

  // Deck metadata
  name: string
  description?: string
  format: string
  heroName?: string
  isPublic: boolean

  // External references
  fabraryUrl?: string
  fabraryDeckId?: string
  slug?: string  // Kept for display in navbar, not used for lookups

  // Core deck data - structured by category
  hero: DeckPrinting[]           // Max 1 card (non-young for CC/LL)
  equipment: DeckPrinting[]      // Equipment and weapons
  maindeck: DeckPrinting[]       // Main deck cards (60+ for CC/LL, 40+ for Blitz)
  inventory: DeckPrinting[]      // Cards in your card pool but not in deck (sideboard equivalent)
  maybeboard?: DeckPrinting[]    // Cards you're considering (no limit)
  tokens?: DeckPrinting[]        // Token cards (not counted toward deck limits)

  // Cached stats (computed from nested arrays)
  totalCards?: number
  estimatedValue?: number
  lastPriceUpdate?: Date

  // Category counts (computed from array lengths)
  heroCount?: number
  equipmentCount?: number
  maindeckCount?: number
  inventoryCount?: number
  maybeboardCount?: number
  tokensCount?: number
  
  // Card pool count (equipment + maindeck + inventory) - used for format validation
  cardPoolCount?: number

  // Format validation
  isFormatLegal?: boolean
  formatErrors?: string[]

  // System fields
  createdAt: Date
  updatedAt: Date

  // Optional metadata
  tags?: string[]
  metadata?: Record<string, any>

  // Methods
  calculateStats(): {
    totalCards: number
    heroCount: number
    equipmentCount: number
    maindeckCount: number
    inventoryCount: number
    maybeboardCount: number
    tokensCount: number
    cardPoolCount: number
  }
  setFabraryUrl(url: string): IDeck
  addPrinting(
    category: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    printingId: string,
    condition?: DeckPrinting["condition"],
    notes?: string,
    position?: number // Optional position for insertion
  ): IDeck
  removePrinting(
    category: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    printingId: string
  ): IDeck
  movePrinting(
    fromCategory: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    toCategory: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    printingId: string,
    toPosition?: number
  ): IDeck
  reorderCategory(
    category: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    fromIndex: number,
    toIndex: number
  ): IDeck
  swapPrinting(
    category: keyof Pick<IDeck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>,
    index: number,
    newPrintingId: string,
    condition?: string,
    notes?: string
  ): IDeck
  getUniqueCardIds(): Promise<string[]>
  getAllPrintings(): DeckPrinting[] // Helper to get all printings across categories
  validateFormat(): Promise<{ isLegal: boolean; errors: string[] }>
  normalizeEquipment(): { moved: DeckPrinting[]; updated: boolean } // Fix duplicate equipment slots
}

const DeckPrintingSchema = new Schema({
  printingId: {
    type: String,
    required: true,
  },
  condition: {
    type: String,
    default: "NM",
    enum: ["NM", "LP", "MP", "HP", "DMG"],
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  printingDetails: {
    type: Schema.Types.Mixed,
    default: undefined
  }
})

const DeckSchema = new Schema<IDeck>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(),
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    format: {
      type: String,
      required: true,
      enum: [
        "Classic Constructed",
        "Silver Age",
        "Blitz",
        "Commoner",
        "Living Legend",
        "Limited",
        "Ultimate Pit Fight",
        "Casual",
      ],
    },
    heroName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    fabraryUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (url: string) {
          if (!url) return true
          return url.match(/^https:\/\/fabrary\.net\/decks\/[A-Z0-9]+$/)
        },
        message:
          "Invalid Fabrary URL format. Expected: https://fabrary.net/decks/DECKID",
      },
    },
    fabraryDeckId: {
      type: String,
      trim: true,
      uppercase: true,
      match: /^[A-Z0-9]+$/,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: false, // Not unique globally, but should be unique per user
    },

    // Nested arrays for each category
    hero: {
      type: [DeckPrintingSchema],
      default: [],
      validate: {
        validator: function (hero: DeckPrinting[]) {
          return hero.length <= 1
        },
        message: "Hero can only contain 1 card",
      },
    },
    equipment: {
      type: [DeckPrintingSchema],
      default: [],
      validate: {
        validator: function (equipment: DeckPrinting[]) {
          return equipment.length <= 20 // Reasonable limit
        },
        message: "Equipment cannot exceed 20 cards",
      },
    },
    maindeck: {
      type: [DeckPrintingSchema],
      default: [],
      validate: {
        validator: function (maindeck: DeckPrinting[]) {
          return maindeck.length <= 80
        },
        message: "Main deck cannot exceed 80 cards",
      },
    },
    inventory: {
      type: [DeckPrintingSchema],
      default: [],
    },
    maybeboard: {
      type: [DeckPrintingSchema],
      default: [],
      // No limit on maybeboard
    },
    tokens: {
      type: [DeckPrintingSchema],
      default: [],
      // No limit on tokens (they don't count toward deck limits)
    },

    // Cached stats
    totalCards: { type: Number, default: 0, min: 0 },
    estimatedValue: { type: Number, default: 0, min: 0 },
    lastPriceUpdate: { type: Date, default: Date.now },
    heroCount: { type: Number, default: 0, min: 0, max: 1 },
    equipmentCount: { type: Number, default: 0, min: 0 },
    maindeckCount: { type: Number, default: 0, min: 0 },
    inventoryCount: { type: Number, default: 0, min: 0 },
    maybeboardCount: { type: Number, default: 0, min: 0 },
    tokensCount: { type: Number, default: 0, min: 0 },
    cardPoolCount: { type: Number, default: 0, min: 0 }, // equipment + maindeck + inventory
    isFormatLegal: { type: Boolean, default: true },
    formatErrors: { type: [String], default: [] },
    tags: { type: [String], default: [], maxlength: 10 },
    metadata: { type: Object, default: {} },
  },
  { 
    timestamps: true,
    strict: false,
    collection: 'decks'
  }
)

// Indexes (publicId unique index already defined in schema field at line 149)
DeckSchema.index({ userId: 1, isPublic: 1 })
DeckSchema.index({ userId: 1, format: 1 })
DeckSchema.index({ userId: 1, slug: 1 })
DeckSchema.index({ isPublic: 1, format: 1 })
DeckSchema.index({ createdAt: -1 })
DeckSchema.index({ estimatedValue: -1 })

// Compound indexes for printings across all categories
DeckSchema.index({ "hero.printingId": 1 })
DeckSchema.index({ "equipment.printingId": 1 })
DeckSchema.index({ "maindeck.printingId": 1 })
DeckSchema.index({ "inventory.printingId": 1 })

// Methods
DeckSchema.methods.calculateStats = function () {
  const stats = {
    heroCount: this.hero.length,
    equipmentCount: this.equipment.length,
    maindeckCount: this.maindeck.length,
    inventoryCount: this.inventory?.length || 0,
    maybeboardCount: this.maybeboard?.length || 0,
    tokensCount: this.tokens?.length || 0,
    cardPoolCount: this.equipment.length + this.maindeck.length + (this.inventory?.length || 0),
    totalCards: this.hero.length + this.equipment.length + this.maindeck.length + (this.inventory?.length || 0),
  }
  Object.assign(this, stats)
  return stats
}

DeckSchema.methods.setFabraryUrl = function (url: string) {
  if (!url) {
    this.fabraryUrl = undefined
    this.fabraryDeckId = undefined
    return this
  }
  const match = url.match(/^https:\/\/fabrary\.net\/decks\/([A-Z0-9]+)$/)
  if (!match) {
    throw new Error(
      "Invalid Fabrary URL format. Expected: https://fabrary.net/decks/DECKID"
    )
  }
  this.fabraryUrl = url
  this.fabraryDeckId = match[1]
  return this
}

DeckSchema.methods.addPrinting = function (
  category: string,
  printingId: string,
  condition: DeckPrinting["condition"] = "NM",
  notes?: string,
  position?: number
) {
  const printing = {
    printingId,
    condition,
    notes,
    addedAt: new Date(),
  }
  
  const categoryArray = this[category] as DeckPrinting[]
  if (typeof position === 'number' && position >= 0 && position <= categoryArray.length) {
    categoryArray.splice(position, 0, printing)
  } else {
    categoryArray.push(printing)
  }
  
  this.calculateStats()
  return this
}

DeckSchema.methods.removePrinting = function (category: string, printingId: string) {
  const categoryArray = this[category] as DeckPrinting[]
  const index = categoryArray.findIndex(p => p.printingId === printingId)
  if (index !== -1) {
    categoryArray.splice(index, 1)
    this.calculateStats()
  }
  return this
}

DeckSchema.methods.movePrinting = function (
  fromCategory: string,
  toCategory: string,
  printingId: string,
  toPosition?: number
) {
  const fromArray = this[fromCategory] as DeckPrinting[]
  const toArray = this[toCategory] as DeckPrinting[]
  
  const fromIndex = fromArray.findIndex(p => p.printingId === printingId)
  if (fromIndex === -1) return this
  
  const [printing] = fromArray.splice(fromIndex, 1)
  
  if (typeof toPosition === 'number' && toPosition >= 0 && toPosition <= toArray.length) {
    toArray.splice(toPosition, 0, printing)
  } else {
    toArray.push(printing)
  }
  
  this.calculateStats()
  return this
}

DeckSchema.methods.reorderCategory = function (
  category: string,
  fromIndex: number,
  toIndex: number
) {
  const categoryArray = this[category] as DeckPrinting[]
  if (fromIndex < 0 || fromIndex >= categoryArray.length || 
      toIndex < 0 || toIndex >= categoryArray.length) {
    return this
  }
  
  const [moved] = categoryArray.splice(fromIndex, 1)
  categoryArray.splice(toIndex, 0, moved)
  return this
}

DeckSchema.methods.swapPrinting = function (
  category: string,
  index: number,
  newPrintingId: string,
  condition?: string,
  notes?: string
) {
  const categoryArray = this[category] as DeckPrinting[]
  if (index < 0 || index >= categoryArray.length) {
    throw new Error(`Invalid index ${index} for category ${category}`)
  }
  
  const existingPrinting = categoryArray[index]
  categoryArray[index] = {
    printingId: newPrintingId,
    condition: condition || existingPrinting.condition || 'NM',
    notes: notes || existingPrinting.notes || '',
    addedAt: new Date(),
  }
  
  return this
}

DeckSchema.methods.getAllPrintings = function () {
  return [
    ...this.hero,
    ...this.equipment,
    ...this.maindeck,
    ...(this.inventory || []),
    ...(this.maybeboard || []),
    ...(this.tokens || [])
  ]
}

DeckSchema.methods.getUniqueCardIds = async function () {
  const { FABPrintingsSearchUtility } = await import("@/lib/fab-printings-search")
  const searchUtil = new FABPrintingsSearchUtility()
  const printingIds = this.getAllPrintings().map((p) => p.printingId)
  const results = await searchUtil.searchPrintings({ printingIds })
  const uniqueCardIds = new Set(results.printings.map((p) => p.card_unique_id))
  return Array.from(uniqueCardIds)
}

DeckSchema.methods.normalizeEquipment = function () {
  const moved: DeckPrinting[] = []
  const slots = {
    head: null as DeckPrinting | null,
    chest: null as DeckPrinting | null,
    arms: null as DeckPrinting | null,
    legs: null as DeckPrinting | null,
    weapon1: null as DeckPrinting | null,
    weapon2: null as DeckPrinting | null,
  }

  const validEquipment: DeckPrinting[] = []

  // Process each equipment item
  this.equipment.forEach((item: DeckPrinting) => {
    const types = item.printingDetails?.types || []
    let assigned = false

    // Try to assign to appropriate slot
    if (types.includes('head') && !slots.head) {
      slots.head = item
      assigned = true
    } else if (types.includes('chest') && !slots.chest) {
      slots.chest = item
      assigned = true
    } else if (types.includes('arms') && !slots.arms) {
      slots.arms = item
      assigned = true
    } else if (types.includes('legs') && !slots.legs) {
      slots.legs = item
      assigned = true
    } else if (types.includes('weapon') || types.includes('off-hand')) {
      // Weapons and off-hand items can go in weapon slots
      if (!slots.weapon1) {
        slots.weapon1 = item
        assigned = true
      } else if (!slots.weapon2) {
        slots.weapon2 = item
        assigned = true
      }
    }

    if (assigned) {
      validEquipment.push(item)
    } else {
      // Duplicate or overflow - move to inventory
      moved.push(item)
    }
  })

  // Update equipment array with only valid items
  const updated = moved.length > 0
  if (updated) {
    this.equipment = validEquipment
    // Add moved items to inventory
    this.inventory = [...(this.inventory || []), ...moved]
    this.calculateStats()
  }

  return { moved, updated }
}

DeckSchema.methods.validateFormat = async function () {
  const errors: string[] = []
  const stats = this.calculateStats()

  switch (this.format) {
    case "Classic Constructed":
      if (stats.heroCount !== 1) errors.push("Must have exactly 1 hero")
      if (stats.cardPoolCount > 80)
        errors.push("Card pool (equipment + maindeck + inventory) cannot exceed 80 cards")
      if (stats.maindeckCount < 60)
        errors.push("Main deck must have at least 60 cards")

      // TODO: Validate hero is not young

      // Copy limit validation - max 3 of each unique card (by card_unique_id, not printingId)
      // Special rules: Legendary = max 1, Unlimited = no limit
      const ccCardCounts = new Map<string, number>()
      const ccLegendaryViolations: string[] = []

      allCards.forEach(card => {
        const cardUniqueId = card.printingDetails?.card_unique_id || card.printingId
        const keywords = card.printingDetails?.keywords || []
        const keywordsLower = keywords.map((k: string) => k.toLowerCase())

        // Skip unlimited cards - they have no copy limit
        if (keywordsLower.includes('unlimited')) return

        const count = ccCardCounts.get(cardUniqueId) || 0
        ccCardCounts.set(cardUniqueId, count + 1)

        // Check legendary cards separately (max 1 copy)
        if (keywordsLower.includes('legendary') && count + 1 > 1) {
          const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown'
          if (!ccLegendaryViolations.includes(cardName)) {
            ccLegendaryViolations.push(cardName)
          }
        }
      })

      // Check for legendary violations
      if (ccLegendaryViolations.length > 0) {
        errors.push(`Legendary cards can only have 1 copy in deck (found: ${ccLegendaryViolations.join(', ')})`)
      }

      // Check for regular copy limit violations (max 3 for Classic Constructed)
      const ccViolations = Array.from(ccCardCounts.entries())
        .filter(([cardId, count]) => {
          // Find the card to check if it's legendary (already handled above)
          const card = allCards.find(c => (c.printingDetails?.card_unique_id || c.printingId) === cardId)
          const keywords = card?.printingDetails?.keywords || []
          const keywordsLower = keywords.map((k: string) => k.toLowerCase())
          return !keywordsLower.includes('legendary') && count > 3
        })

      if (ccViolations.length > 0) {
        errors.push(`Classic Constructed allows max 3 copies per card (found ${ccViolations.length} cards with 4+ copies)`)
      }
      break

    case "Silver Age":
      // Hero count validation
      if (stats.heroCount !== 1) {
        errors.push("Must have exactly 1 hero")
      }

      // Young hero validation
      const heroCard = this.hero[0]
      if (heroCard?.printingDetails?.is_young !== true) {
        errors.push("Silver Age requires a young hero")
      }

      // Card pool validation
      if (stats.cardPoolCount > 55) {
        errors.push("Card pool (equipment + maindeck + inventory) cannot exceed 55 cards")
      }

      // Maindeck size validation
      if (stats.maindeckCount !== 40) {
        errors.push("Main deck must have exactly 40 cards")
      }

      // Rarity validation - only common, rare, and basic allowed
      const allCards = [
        ...this.hero,
        ...this.equipment,
        ...this.maindeck,
        ...this.inventory
      ]

      const allowedRarities = ['common', 'rare', 'basic']
      const invalidRarityCards = allCards.filter(card => {
        const rarity = card.printingDetails?.rarity?.toLowerCase()
        return rarity && !allowedRarities.includes(rarity)
      })

      if (invalidRarityCards.length > 0) {
        errors.push(`Silver Age only allows common, rare, and basic cards (found ${invalidRarityCards.length} invalid cards)`)
      }

      // Copy limit validation - max 2 of each unique card (by card_unique_id, not printingId)
      // Special rules: Legendary = max 1, Unlimited = no limit
      const cardCounts = new Map<string, number>()
      const legendaryViolations: string[] = []

      allCards.forEach(card => {
        const cardUniqueId = card.printingDetails?.card_unique_id || card.printingId
        const keywords = card.printingDetails?.keywords || []
        const keywordsLower = keywords.map((k: string) => k.toLowerCase())

        // Skip unlimited cards - they have no copy limit
        if (keywordsLower.includes('unlimited')) return

        const count = cardCounts.get(cardUniqueId) || 0
        cardCounts.set(cardUniqueId, count + 1)

        // Check legendary cards separately (max 1 copy)
        if (keywordsLower.includes('legendary') && count + 1 > 1) {
          const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown'
          if (!legendaryViolations.includes(cardName)) {
            legendaryViolations.push(cardName)
          }
        }
      })

      // Check for legendary violations
      if (legendaryViolations.length > 0) {
        errors.push(`Legendary cards can only have 1 copy in deck (found: ${legendaryViolations.join(', ')})`)
      }

      // Check for regular copy limit violations (max 2 for Silver Age)
      const violations = Array.from(cardCounts.entries())
        .filter(([cardId, count]) => {
          // Find the card to check if it's legendary (already handled above)
          const card = allCards.find(c => (c.printingDetails?.card_unique_id || c.printingId) === cardId)
          const keywords = card?.printingDetails?.keywords || []
          const keywordsLower = keywords.map((k: string) => k.toLowerCase())
          return !keywordsLower.includes('legendary') && count > 2
        })

      if (violations.length > 0) {
        errors.push(`Silver Age allows max 2 copies per card (found ${violations.length} cards with 3+ copies)`)
      }
      break

    case "Blitz":
      if (stats.heroCount !== 1) errors.push("Must have exactly 1 hero")
      if (stats.cardPoolCount > 52)
        errors.push("Card pool (equipment + maindeck + inventory) cannot exceed 52 cards")
      if (stats.maindeckCount !== 40)
        errors.push("Main deck must have exactly 40 cards")
      // TODO: Validate max 2 copies of each unique card
      break

    case "Living Legend":
      if (stats.heroCount !== 1) errors.push("Must have exactly 1 hero")
      if (stats.cardPoolCount > 80)
        errors.push("Card pool (equipment + maindeck + inventory) cannot exceed 80 cards")
      if (stats.maindeckCount < 60)
        errors.push("Main deck must have at least 60 cards")
      // TODO: Validate hero is not young
      // TODO: Validate max 3 copies of each unique card
      break

    case "Commoner":
      if (stats.heroCount !== 1) errors.push("Must have exactly 1 hero")
      if (stats.maindeckCount < 60)
        errors.push("Main deck must have at least 60 cards")
      // TODO: Validate only common cards allowed
      break
  }

  this.formatErrors = errors
  this.isFormatLegal = errors.length === 0
  return { isLegal: this.isFormatLegal, errors: this.formatErrors }
}

// Pre-save middleware
DeckSchema.pre("save", function (next) {
  this.calculateStats()
  next()
})

export const Deck = mongoose.models.Deck || mongoose.model<IDeck>("Deck", DeckSchema)

export default Deck
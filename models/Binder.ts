//models/Binder.ts

import mongoose, { Schema, type Document } from "mongoose"

export interface BinderCard {
  id: string
  cardId: string
  name: string
  quantity: number
  condition?: string
  notes?: string
  forTrade: boolean
  printingDetails?: {
    display_name?: string
    printing_id?: string
    card_unique_id?: string
    set_id?: string
    edition?: string
    foiling?: string
    rarity?: string
    color?: string
    type_text?: string
    tcgplayer_url?: string
    tcg_low?: number | null
    tcg_mid?: number | null
    tcg_high?: number | null
    tcg_market?: number | null
    image_url?: string
    art_variations?: string[]
    tcgplayer_product_id?: string
    price_updated_at?: Date
  }
}

// NEW: Showcase card interface for top valuable for-trade cards
export interface ShowcaseCard {
  printingId: string
  tcg_low: number
  rarity: string
}

export interface IBinder extends Document {
  userId: mongoose.Types.ObjectId
  isPublic: boolean
  visibility?: {
    level: 'public' | 'private' | 'friends' | 'unlisted'
    allowInSearch: boolean
    allowInMatching: boolean
    allowDiscordCommands: boolean
    allowApiExport: boolean
    allowWhoHas: boolean
    allowWebhooks: boolean        // NEW: Webhook access control
  }
  name: string
  description?: string
  tags?: string[]
  metadata?: Record<string, any>
  cards: BinderCard[]
  rarityCounts: {
    C: number
    R: number
    S: number
    M: number
    L: number
    F: number
    T: number
    V: number
    P: number
  }
  
  // OLD STATS FIELDS (for backward compatibility)
  total_value: number
  total_value_updated_at: Date
  total_cards_with_pricing: number
  total_cards_without_pricing: number
  
  // NEW COMPREHENSIVE STATS FIELDS (from inventory_items)
  totalQuantity?: number
  quantityForTrade?: number
  quantityNotForTrade?: number
  totalValue?: {
    tcg_market: number
    tcg_low: number    
    tcg_mid: number
    tcg_high: number
  }
  valueForTrade?: {
    tcg_market: number
    tcg_low: number    
    tcg_mid: number
    tcg_high: number
  }
  valueNotForTrade?: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  rarityCountsForTrade?: Map<string, number>
  rarityCountsNotForTrade?: Map<string, number>
  showcaseCards?: ShowcaseCard[]  
  statsUpdatedAt?: Date
  
  createdAt: Date
  updatedAt: Date
  archived?: boolean
  forTradeAll?: boolean
  discordExternalId?: string
  slug?: string
  discordUsername?: string
  discordId?: string
  isOnHand?: boolean
  thumbnailPrintingId?: string
}

const BinderCardSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  cardId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
  },
  condition: {
    type: String,
    default: "NM",
  },
  notes: String,
  forTrade: {
    type: Boolean,
    default: true,
  },
  printingDetails: {
    display_name: String,
    printing_id: String,
    card_unique_id: String,
    set_id: String,
    edition: String,
    foiling: String,
    rarity: String,
    color: String,
    type_text: String,
    tcgplayer_url: String,
    tcgplayer_product_id: String,
    tcg_low: Number,
    tcg_mid: Number,
    tcg_high: Number,
    tcg_market: Number,
    price_updated_at: Date,
    image_url: String,
    art_variations: [String],
  },
})

// NEW: Showcase card schema for top valuable for-trade cards
const ShowcaseCardSchema = new Schema({
  printingId: {
    type: String,
    required: true,
  },
  tcg_low: {
    type: Number,
    required: true,
    min: 0,
  },
  rarity: {
    type: String,
    required: true,
  },
}, { _id: false })

const BinderSchema = new Schema<IBinder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    visibility: {
      type: {
        level: { type: String, enum: ['public', 'private', 'friends', 'unlisted'], default: 'public' },
        allowInSearch: { type: Boolean, default: true },
        allowInMatching: { type: Boolean, default: true },
        allowDiscordCommands: { type: Boolean, default: true },
        allowApiExport: { type: Boolean, default: true },
        allowWhoHas: { type: Boolean, default: true },
        allowWebhooks: { type: Boolean, default: true }    // NEW: Webhook visibility control
      },
      default: () => ({
        level: 'public',
        allowInSearch: true,
        allowInMatching: true,
        allowDiscordCommands: true,
        allowApiExport: true,
        allowWhoHas: true,
        allowWebhooks: true    // NEW: Default to true for webhooks
      })
    },
    name: {
      type: String,
      required: true,
      default: "My Trade Binder",
    },
    description: {
      type: String,
      maxlength: 500,
    },
    tags: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Object,
      default: {},
    },
    cards: {
      type: [BinderCardSchema],
      default: [],
    },
    rarityCounts: {
      type: {
        C: { type: Number, default: 0 },
        R: { type: Number, default: 0 },
        S: { type: Number, default: 0 },
        M: { type: Number, default: 0 },
        L: { type: Number, default: 0 },
        F: { type: Number, default: 0 },
        T: { type: Number, default: 0 },
        V: { type: Number, default: 0 },
        P: { type: Number, default: 0 },
      },
      default: () => ({ C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, V: 0, P: 0 }),
    },
    
    // OLD STATS FIELDS (for backward compatibility with legacy cards array)
    total_value: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_value_updated_at: {
      type: Date,
      default: Date.now,
    },
    total_cards_with_pricing: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_cards_without_pricing: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // NEW COMPREHENSIVE STATS FIELDS (from inventory_items collection)
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityForTrade: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityNotForTrade: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalValue: {
      tcg_market: { type: Number, default: 0 },
      tcg_low: { type: Number, default: 0 },
      tcg_mid: { type: Number, default: 0 },
      tcg_high: { type: Number, default: 0 },
    },
    valueForTrade: {
      tcg_market: { type: Number, default: 0 },
      tcg_low: { type: Number, default: 0 },
      tcg_mid: { type: Number, default: 0 },
      tcg_high: { type: Number, default: 0 },
    },
    valueNotForTrade: {
      tcg_market: { type: Number, default: 0 },
      tcg_low: { type: Number, default: 0 },
      tcg_mid: { type: Number, default: 0 },
      tcg_high: { type: Number, default: 0 },
    },
    rarityCountsForTrade: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    rarityCountsNotForTrade: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    showcaseCards: {
      type: [ShowcaseCardSchema],
      default: [],
      validate: {
        validator: function(cards: ShowcaseCard[]) {
          return cards.length <= 6; 
        },
        message: 'Showcase cards cannot exceed 3 items'
      }
    },
    statsUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    statsNeedUpdate: {
      type: Boolean,
      default: false,
      index: true, 
    },
    
    forTradeAll: {
      type: Boolean,
      default: undefined,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-_]{3,20}$/,
      required: false,
    },
    discordExternalId: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-_]{3,20}$/,
      required: false,
    },
    discordUsername: {
      type: String,
      trim: true,
      required: false,
    },
    discordId: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    isOnHand: {
      type: Boolean,
      default: false,
    },
    thumbnailPrintingId: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
)

// Create indexes for efficient querying
BinderSchema.index({ userId: 1, isPublic: 1 })
BinderSchema.index({ "cards.cardId": 1 })
BinderSchema.index({ userId: 1, slug: 1 }, { unique: true, sparse: true });
BinderSchema.index({ "visibility.level": 1, "visibility.allowInSearch": 1 })
BinderSchema.index({ "showcaseCards.printingId": 1 })

// Helper method to calculate total value (OLD SYSTEM - for backward compatibility)
BinderSchema.methods.calculateTotalValue = function() {
  let totalValue = 0;
  let cardsWithPricing = 0;
  let cardsWithoutPricing = 0;

  this.cards.forEach((card: BinderCard) => {
    const tcgMarket = card.printingDetails?.tcg_market;
    if (tcgMarket && tcgMarket > 0) {
      totalValue += tcgMarket * card.quantity;
      cardsWithPricing++;
    } else {
      cardsWithoutPricing++;
    }
  });

  this.total_value = Math.round(totalValue * 100) / 100;
  this.total_value_updated_at = new Date();
  this.total_cards_with_pricing = cardsWithPricing;
  this.total_cards_without_pricing = cardsWithoutPricing;

  return {
    total_value: this.total_value,
    total_cards_with_pricing: cardsWithPricing,
    total_cards_without_pricing: cardsWithoutPricing
  };
};

// Helper method to get primary collection value (NEW SYSTEM)
BinderSchema.methods.getPrimaryValue = function() {
  return this.totalValue?.tcg_low || this.total_value || 0;
};

// Helper method to get total card count (NEW SYSTEM)
BinderSchema.methods.getTotalCards = function() {
  return this.totalQuantity || this.cards?.length || 0;
};

// NEW: Helper method to get showcase card image URLs
BinderSchema.methods.getShowcaseImageUrls = function(baseUrl: string = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg') {
  if (!this.showcaseCards || this.showcaseCards.length === 0) {
    return [];
  }
  
  return this.showcaseCards.map((card: ShowcaseCard) => ({
    printingId: card.printingId,
    imageUrl: `${baseUrl}/${card.printingId}/public`,
    value: card.tcg_low,
    rarity: card.rarity
  }));
};

// NEW: Helper method to check if binder has high-value showcase cards
BinderSchema.methods.hasHighValueShowcase = function(threshold: number = 50) {
  if (!this.showcaseCards || this.showcaseCards.length === 0) {
    return false;
  }
  
  return this.showcaseCards.some((card: ShowcaseCard) => card.tcg_low >= threshold);
};

// Create the model if it doesn't exist, otherwise use the existing one
export const Binder = mongoose.models.Binder || mongoose.model<IBinder>("Binder", BinderSchema)

export default Binder
// //models/Binder.ts

// import mongoose, { Schema, type Document } from "mongoose"

// export interface BinderCard {
//   id: string
//   cardId: string
//   name: string
//   quantity: number
//   condition?: string
//   notes?: string
//   forTrade: boolean
//   printingDetails?: {
//     display_name?: string
//     printing_id?: string
//     card_unique_id?: string
//     set_id?: string
//     edition?: string
//     foiling?: string
//     rarity?: string
//     color?: string
//     type_text?: string
//     tcgplayer_url?: string
//     tcg_low?: number | null
//     tcg_mid?: number | null
//     tcg_high?: number | null
//     tcg_market?: number | null
//     image_url?: string
//     art_variations?: string[]
//     tcgplayer_product_id?: string
//     price_updated_at?: Date
//   }
// }

// // NEW: Showcase card interface for top valuable for-trade cards
// export interface ShowcaseCard {
//   printingId: string
//   tcg_low: number
//   rarity: string
// }

// export interface IBinder extends Document {
//   userId: mongoose.Types.ObjectId
//   isPublic: boolean
//   visibility?: {
//     level: 'public' | 'private' | 'friends' | 'unlisted'
//     allowInSearch: boolean
//     allowInMatching: boolean
//     allowDiscordCommands: boolean
//     allowApiExport: boolean
//     allowWhoHas: boolean
//   }
//   name: string
//   description?: string
//   tags?: string[]
//   metadata?: Record<string, any>
//   cards: BinderCard[]
//   rarityCounts: {
//     C: number
//     R: number
//     S: number
//     M: number
//     L: number
//     F: number
//     T: number
//     V: number
//     P: number
//   }
  
//   // OLD STATS FIELDS (for backward compatibility)
//   total_value: number // Total USD value of all cards in binder
//   total_value_updated_at: Date // When the value was last calculated
//   total_cards_with_pricing: number // How many cards have pricing data
//   total_cards_without_pricing: number // How many cards lack pricing data
  
//   // NEW COMPREHENSIVE STATS FIELDS (from inventory_items)
//   totalQuantity?: number
//   quantityForTrade?: number
//   quantityNotForTrade?: number
//   totalValue?: {
//     tcg_market: number
//     tcg_low: number    
//     tcg_mid: number
//     tcg_high: number
//   }
//   valueForTrade?: {
//     tcg_market: number
//     tcg_low: number    
//     tcg_mid: number
//     tcg_high: number
//   }
//   valueNotForTrade?: {
//     tcg_market: number
//     tcg_low: number
//     tcg_mid: number
//     tcg_high: number
//   }
//   rarityCountsForTrade?: Map<string, number>
//   rarityCountsNotForTrade?: Map<string, number>
//   showcaseCards?: ShowcaseCard[]  
//   statsUpdatedAt?: Date
  
//   createdAt: Date
//   updatedAt: Date
//   archived?: boolean
//   forTradeAll?: boolean
//   discordExternalId?: string
//   slug?: string
//   discordUsername?: string
//   discordId?: string
//   isOnHand?: boolean
// }

// const BinderCardSchema = new Schema({
//   id: {
//     type: String,
//     required: true,
//   },
//   cardId: {
//     type: String,
//     required: true,
//   },
//   name: {
//     type: String,
//     required: true,
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     default: 1,
//     min: 1,
//   },
//   condition: {
//     type: String,
//     default: "NM",
//   },
//   notes: String,
//   forTrade: {
//     type: Boolean,
//     default: true,
//   },
//   printingDetails: {
//     display_name: String,
//     printing_id: String,
//     card_unique_id: String,
//     set_id: String,
//     edition: String,
//     foiling: String,
//     rarity: String,
//     color: String,
//     type_text: String,
//     tcgplayer_url: String,
//     tcgplayer_product_id: String,
//     tcg_low: Number,
//     tcg_mid: Number,
//     tcg_high: Number,
//     tcg_market: Number,
//     price_updated_at: Date,
//     image_url: String,
//     art_variations: [String],
//   },
// })

// // NEW: Showcase card schema for top valuable for-trade cards
// const ShowcaseCardSchema = new Schema({
//   printingId: {
//     type: String,
//     required: true,
//   },
//   tcg_low: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   rarity: {
//     type: String,
//     required: true,
//   },
// }, { _id: false }) // Don't create _id for subdocuments

// const BinderSchema = new Schema<IBinder>(
//   {
//     userId: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       required: [true, "User ID is required"],
//       index: true,
//     },
//     isPublic: {
//       type: Boolean,
//       default: true,
//     },
//     visibility: {
//       type: {
//         level: { type: String, enum: ['public', 'private', 'friends', 'unlisted'], default: 'public' },
//         allowInSearch: { type: Boolean, default: true },
//         allowInMatching: { type: Boolean, default: true },
//         allowDiscordCommands: { type: Boolean, default: true },
//         allowApiExport: { type: Boolean, default: true },      // Changed from allowMcpFeatures
//         allowWhoHas: { type: Boolean, default: true }          // Changed from allowWebhooks
//       },
//       default: () => ({
//         level: 'public',
//         allowInSearch: true,
//         allowInMatching: true,
//         allowDiscordCommands: true,
//         allowApiExport: true,      // Changed from allowMcpFeatures
//         allowWhoHas: true          // Changed from allowWebhooks
//       })
//     },
//     name: {
//       type: String,
//       required: true,
//       default: "My Trade Binder",
//     },
//     description: {
//       type: String,
//       maxlength: 500,
//     },
//     tags: {
//       type: [String],
//       default: [],
//     },
//     metadata: {
//       type: Object,
//       default: {},
//     },
//     cards: {
//       type: [BinderCardSchema],
//       default: [],
//     },
//     rarityCounts: {
//       type: {
//         C: { type: Number, default: 0 },
//         R: { type: Number, default: 0 },
//         S: { type: Number, default: 0 },
//         M: { type: Number, default: 0 },
//         L: { type: Number, default: 0 },
//         F: { type: Number, default: 0 },
//         T: { type: Number, default: 0 },
//         V: { type: Number, default: 0 },
//         P: { type: Number, default: 0 },
//       },
//       default: () => ({ C: 0, R: 0, S: 0, M: 0, L: 0, F: 0, T: 0, V: 0, P: 0 }),
//     },
    
//     // OLD STATS FIELDS (for backward compatibility with legacy cards array)
//     total_value: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     total_value_updated_at: {
//       type: Date,
//       default: Date.now,
//     },
//     total_cards_with_pricing: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     total_cards_without_pricing: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
    
//     // NEW COMPREHENSIVE STATS FIELDS (from inventory_items collection)
//     totalQuantity: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     quantityForTrade: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     quantityNotForTrade: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     totalValue: {
//       tcg_market: { type: Number, default: 0 },
//       tcg_low: { type: Number, default: 0 },      // Primary value field
//       tcg_mid: { type: Number, default: 0 },
//       tcg_high: { type: Number, default: 0 },
//     },
//     valueForTrade: {
//       tcg_market: { type: Number, default: 0 },
//       tcg_low: { type: Number, default: 0 },      // Primary value field
//       tcg_mid: { type: Number, default: 0 },
//       tcg_high: { type: Number, default: 0 },
//     },
//     valueNotForTrade: {
//       tcg_market: { type: Number, default: 0 },
//       tcg_low: { type: Number, default: 0 },      // Primary value field
//       tcg_mid: { type: Number, default: 0 },
//       tcg_high: { type: Number, default: 0 },
//     },
//     rarityCountsForTrade: {
//       type: Map,
//       of: Number,
//       default: () => new Map(),
//     },
//     rarityCountsNotForTrade: {
//       type: Map,
//       of: Number,
//       default: () => new Map(),
//     },
//     showcaseCards: {
//       type: [ShowcaseCardSchema],
//       default: [],
//       validate: {
//         validator: function(cards: ShowcaseCard[]) {
//           return cards.length <= 6; 
//         },
//         message: 'Showcase cards cannot exceed 3 items'
//       }
//     },
//     statsUpdatedAt: {
//       type: Date,
//       default: Date.now,
//     },
//     statsNeedUpdate: {
//       type: Boolean,
//       default: false,
//       index: true, 
//     },
    
//     forTradeAll: {
//       type: Boolean,
//       default: undefined,
//     },
//     archived: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//     slug: {
//       type: String,
//       trim: true,
//       lowercase: true,
//       match: /^[a-z0-9-_]{3,20}$/,
//       required: false,
//     },
//     discordExternalId: {
//       type: String,
//       trim: true,
//       lowercase: true,
//       match: /^[a-z0-9-_]{3,20}$/,
//       required: false,
//     },
//     discordUsername: {
//       type: String,
//       trim: true,
//       required: false,
//     },
//     discordId: {
//       type: String,
//       trim: true,
//       required: false,
//       index: true,
//     },
//     isOnHand: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   },
// )

// // Create indexes for efficient querying
// BinderSchema.index({ userId: 1, isPublic: 1 })
// BinderSchema.index({ "cards.cardId": 1 })
// BinderSchema.index({ userId: 1, slug: 1 }, { unique: true, sparse: true });
// BinderSchema.index({ "visibility.level": 1, "visibility.allowInSearch": 1 })
// BinderSchema.index({ "showcaseCards.printingId": 1 }) // NEW: Index for showcase card queries

// // Helper method to calculate total value (OLD SYSTEM - for backward compatibility)
// BinderSchema.methods.calculateTotalValue = function() {
//   let totalValue = 0;
//   let cardsWithPricing = 0;
//   let cardsWithoutPricing = 0;

//   this.cards.forEach((card: BinderCard) => {
//     const tcgMarket = card.printingDetails?.tcg_market;
//     if (tcgMarket && tcgMarket > 0) {
//       totalValue += tcgMarket * card.quantity;
//       cardsWithPricing++;
//     } else {
//       cardsWithoutPricing++;
//     }
//   });

//   // Update the OLD binder fields (for backward compatibility)
//   this.total_value = Math.round(totalValue * 100) / 100; // Round to 2 decimal places
//   this.total_value_updated_at = new Date();
//   this.total_cards_with_pricing = cardsWithPricing;
//   this.total_cards_without_pricing = cardsWithoutPricing;

//   return {
//     total_value: this.total_value,
//     total_cards_with_pricing: cardsWithPricing,
//     total_cards_without_pricing: cardsWithoutPricing
//   };
// };

// // Helper method to get primary collection value (NEW SYSTEM)
// BinderSchema.methods.getPrimaryValue = function() {
//   // Use tcg_low as primary value from new stats system
//   return this.totalValue?.tcg_low || this.total_value || 0;
// };

// // Helper method to get total card count (NEW SYSTEM)
// BinderSchema.methods.getTotalCards = function() {
//   // Use new totalQuantity if available, fallback to old cards array length
//   return this.totalQuantity || this.cards?.length || 0;
// };

// // NEW: Helper method to get showcase card image URLs
// BinderSchema.methods.getShowcaseImageUrls = function(baseUrl: string = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg') {
//   if (!this.showcaseCards || this.showcaseCards.length === 0) {
//     return [];
//   }
  
//   return this.showcaseCards.map((card: ShowcaseCard) => ({
//     printingId: card.printingId,
//     imageUrl: `${baseUrl}/${card.printingId}/public`,
//     value: card.tcg_low,
//     rarity: card.rarity
//   }));
// };

// // NEW: Helper method to check if binder has high-value showcase cards
// BinderSchema.methods.hasHighValueShowcase = function(threshold: number = 50) {
//   if (!this.showcaseCards || this.showcaseCards.length === 0) {
//     return false;
//   }
  
//   return this.showcaseCards.some((card: ShowcaseCard) => card.tcg_low >= threshold);
// };

// // Create the model if it doesn't exist, otherwise use the existing one
// export const Binder = mongoose.models.Binder || mongoose.model<IBinder>("Binder", BinderSchema)

// export default Binder
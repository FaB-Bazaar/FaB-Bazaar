// models/PrintingCore.ts
import { Schema, model, models } from 'mongoose';

const PrintingCoreSchema = new Schema({
  // --- Core Identifiers ---
  printing_id: { type: String, required: true, unique: true, index: true },
  card_unique_id: { type: String, required: true, index: true },
  collector_number: { type: String, index: true },

  // --- Display Information ---
  // Indexed for fast searching and sorting
  name: { type: String, required: true, index: true }, // <-- INDEX ADDED HERE
  
  display_name: { type: String, required: true }, 
  image_url: { type: String },
  tcgplayer_url: { type: String },

  // --- Card Attributes ---
  rarity: { type: String },
  foiling: { type: String },
  set: { type: String }, 
  edition: { type: String },
  type_text: { type: String }, 
  type_text_display: { type: String },
  color: { 
    type: String, 
    enum: ['', 'red', 'blue', 'yellow'],
    default: ''
  },

  // --- Pricing Information ---
  tcg_market: { type: Number },
  tcg_low: { type: Number },
  tcg_mid: { type: Number },
  tcg_high: { type: Number },
  
  // --- Boolean Flags for Easy Filtering ---
  is_extended_art: { type: Boolean },
  has_price: { type: Boolean },

  // --- Timestamps ---
  created_at: { type: Date },
  updated_at: { type: Date },
  price_updated_at: { type: Date },

}, {
  // --- Schema Options ---
  collection: 'printings_core',
  strict: false,
  timestamps: false 
});

// This prevents Mongoose from redefining the model on every hot-reload in development
export default models.PrintingCore || model('PrintingCore', PrintingCoreSchema);
// // models/PrintingCore.ts
// import { Schema, model, models } from 'mongoose';

// const PrintingCoreSchema = new Schema({
//   // --- Core Identifiers ---
//   printing_id: { type: String, required: true, unique: true, index: true },
//   card_unique_id: { type: String, required: true, index: true },
//   collector_number: { type: String, index: true },

//   // --- Display Information ---
//   // Indexed for fast searching and sorting
//   name: { type: String, required: true, index: true }, // <-- INDEX ADDED HERE
  
//   display_name: { type: String, required: true }, 
//   image_url: { type: String },
//   tcgplayer_url: { type: String },

//   // --- Card Attributes ---
//   rarity: { type: String },
//   foiling: { type: String },
//   set: { type: String }, 
//   edition: { type: String },
//   type_text: { type: String }, 
//   type_text_display: { type: String },

//   // --- Pricing Information ---
//   tcg_market: { type: Number },
//   tcg_low: { type: Number },
//   tcg_mid: { type: Number },
//   tcg_high: { type: Number },
  
//   // --- Boolean Flags for Easy Filtering ---
//   is_extended_art: { type: Boolean },
//   has_price: { type: Boolean },

//   // --- Timestamps ---
//   created_at: { type: Date },
//   updated_at: { type: Date },
//   price_updated_at: { type: Date },

// }, {
//   // --- Schema Options ---
//   collection: 'printings_core',
//   strict: false,
//   timestamps: false 
// });

// // This prevents Mongoose from redefining the model on every hot-reload in development
// export default models.PrintingCore || model('PrintingCore', PrintingCoreSchema);
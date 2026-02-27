import mongoose, { Schema, type Document } from "mongoose"

// Set Schema
export interface ISet extends Document {
  code: string
  name: string
  releaseDate?: Date
  isPromo: boolean
  category: string
  logoUrl?: string
  outOfPrint: boolean
}

const SetSchema = new Schema<ISet>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  releaseDate: {
    type: Date,
  },
  isPromo: {
    type: Boolean,
    default: false,
  },
  category: {
    type: String,
    required: true,
    enum: ["main", "blitz", "promo", "other"],
    default: "main",
  },
  logoUrl: {
    type: String,
  },
  outOfPrint: {
    type: Boolean,
    default: false,
  },
})

// Edition Schema
export interface IEdition extends Document {
  code: string
  name: string
  displayClass: string
}

const EditionSchema = new Schema<IEdition>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  displayClass: {
    type: String,
    required: true,
    trim: true,
  },
})

// Foiling Schema
export interface IFoiling extends Document {
  code: string
  name: string
  abbreviation: string
  displayClass: string
}

const FoilingSchema = new Schema<IFoiling>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  abbreviation: {
    type: String,
    required: true,
    trim: true,
  },
  displayClass: {
    type: String,
    required: true,
    trim: true,
  },
})

// Rarity Schema
export interface IRarity extends Document {
  code: string
  name: string
  abbreviation: string
  displayClass: string
}

const RaritySchema = new Schema<IRarity>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  abbreviation: {
    type: String,
    required: true,
    trim: true,
  },
  displayClass: {
    type: String,
    required: true,
    trim: true,
  },
})

// Art Variation Schema
export interface IArtVariation extends Document {
  code: string
  name: string
  displayClass: string
}

const ArtVariationSchema = new Schema<IArtVariation>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  displayClass: {
    type: String,
    required: true,
    trim: true,
  },
})

// Create models
export const Set = mongoose.models.Set || mongoose.model<ISet>("Set", SetSchema)
export const Edition = mongoose.models.Edition || mongoose.model<IEdition>("Edition", EditionSchema)
export const Foiling = mongoose.models.Foiling || mongoose.model<IFoiling>("Foiling", FoilingSchema)
export const Rarity = mongoose.models.Rarity || mongoose.model<IRarity>("Rarity", RaritySchema)
export const ArtVariation =
  mongoose.models.ArtVariation || mongoose.model<IArtVariation>("ArtVariation", ArtVariationSchema)

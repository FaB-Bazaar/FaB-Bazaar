// models/HeroPrintingCard.ts
import mongoose, { Schema, Document, Model } from "mongoose";

// Interface for a single printing of a hero
export interface IHeroPrinting {
  printingId: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  image_url?: string;
  set_printing_unique_id?: string;
}

// Interface for the HeroPrintingCard document
export interface IHeroPrintingCard extends Document {
  heroSlug: string;
  name: string;
  display_name: string;
  health: number;
  classes: string[];
  talents: string[];
  image_url: string;
  is_young: boolean;
  printings: IHeroPrinting[];
  primary_printing_id: string;
  card_unique_id: string;
  createdAt: Date;
  updatedAt: Date;
}

const HeroPrintingSchema = new Schema<IHeroPrinting>({
  printingId: { type: String, required: true },
  edition: { type: String },
  foiling: { type: String },
  rarity: { type: String },
  image_url: { type: String },
  set_printing_unique_id: { type: String }
});

const HeroPrintingCardSchema = new Schema<IHeroPrintingCard>(
  {
    heroSlug: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      index: true
    },
    display_name: {
      type: String,
      required: true
    },
    health: {
      type: Number,
      required: true
    },
    classes: {
      type: [String],
      default: [],
      index: true
    },
    talents: {
      type: [String],
      default: [],
      index: true
    },
    image_url: {
      type: String,
      required: true
    },
    is_young: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    printings: {
      type: [HeroPrintingSchema],
      default: []
    },
    primary_printing_id: {
      type: String,
      required: true
    },
    card_unique_id: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: "heroprintingcards"
  }
);

// Text search index for hero names
HeroPrintingCardSchema.index({ name: "text", display_name: "text" });

// Compound index for filtering by format (young/adult) and class
HeroPrintingCardSchema.index({ is_young: 1, classes: 1 });

const HeroPrintingCard: Model<IHeroPrintingCard> =
  mongoose.models.HeroPrintingCard ||
  mongoose.model<IHeroPrintingCard>("HeroPrintingCard", HeroPrintingCardSchema);

export default HeroPrintingCard;

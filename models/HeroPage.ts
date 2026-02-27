// models/HeroPage.ts
import mongoose, { Schema, Document } from 'mongoose';

interface ContentBlock {
  type: 'heading' | 'paragraph' | 'card_spotlight' | 'decklist';
  title?: string;
  text?: string;
  printingIds?: string[];
}

export interface IHeroPage extends Document {
  heroName: string; // e.g., "Gravis, Bone Rot Chieftain"
  heroSlug: string; // e.g., "gravis"
  contentBlocks: ContentBlock[];
  authorId?: mongoose.Types.ObjectId;
  lastUpdatedAt: Date;
}

const ContentBlockSchema = new Schema({
  type: { type: String, required: true, enum: ['heading', 'paragraph', 'card_spotlight', 'decklist', 'callout', 'opportunity-card'] },
  title: String,
  text: String,
  printingIds: [String],
}, { _id: false });

const HeroPageSchema = new Schema<IHeroPage>({
  heroName: { type: String, required: true },
  heroSlug: { type: String, required: true, unique: true, index: true },
  contentBlocks: [ContentBlockSchema],
  authorId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const HeroPage = mongoose.models.HeroPage || mongoose.model<IHeroPage>('HeroPage', HeroPageSchema);
export default HeroPage;
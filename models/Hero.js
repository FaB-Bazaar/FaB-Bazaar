import mongoose from 'mongoose';

const LinkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
});

const HeroSchema = new mongoose.Schema({
  heroSlug: { type: String, required: true, unique: true, index: true },

  // Long-form content, stored as Markdown/MDX for rich formatting
  introduction: { type: String, default: '' },
  generalStrategy: { type: String, default: '' },

  // Arrays of printing_ids to feature specific cards
  featuredWeapons: { type: [String], default: [] },
  featuredEquipment: { type: [String], default: [] },
  featuredAttacks: { type: [String], default: [] },
  featuredNonAttacks: { type: [String], default: [] },
  supportingCards: { type: [String], default: [] },

  // External links for community resources
  externalLinks: { type: [LinkSchema], default: [] },

}, { timestamps: true });

export default mongoose.models.Hero || mongoose.model('Hero', HeroSchema);
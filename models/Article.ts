import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// Simplified Section Schema (like your working Hero model)
// ============================================================================

const SectionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'callout', 'opportunity-card', 'spotlight-card', 'intro', 'byline', 'section-header', 'key-takeaways', 'match-report', 'decklist-block']
  },

  // Text section fields
  content: String,

  // Card carousel fields
  cards: [{
    _id: false,
    printingId: String,
    caption: String,
  }],

  // Video section fields
  videoId: String,
  title: String,
  description: String,
  creatorName: String,
  creatorUrl: String,

  // Creator spotlight fields
  imageUrl: String,
  name: String,
  links: [{
    _id: false,
    label: String,
    url: String,
    icon: String,
  }],

  // Callout fields
  text: String,
  linkHref: String,
  linkText: String,

  // Opportunity card fields
  printingId: String,
  reason: {
    type: String,
    enum: ['underpriced', 'trending', 'supply-issue', 'correction', 'outlier']
  },
  confidence: {
    type: String,
    enum: ['low', 'medium', 'high']
  },
  priceChange: {
    old: Number,
    new: Number,
    percentage: Number,
  },
  note: String,

  // Spotlight card fields (shares printingId with opportunity card)
  // title: String, (already defined above)
  commentary: String,

  // Intro section fields
  // text: String, (already defined above for callout)
  tags: String,

  // Byline section fields
  role: String,
  // name: String, (already defined above for creator spotlight)
  link: String,

  // Section header fields
  // title: String, (already defined above)
  subtitle: String,
  level: String,

  // Key takeaways fields
  // title: String, (already defined above)
  items: String,

  // Match report fields
  round: String,
  opponent: String,
  hero: String,
  heroPrintingId: String, // Printing ID for hero card image
  result: String,
  record: String,
  summary: String,
  sideboard: String,
  sideboardCards: [{
    _id: false,
    printingId: String,
    action: String, // 'in' or 'out'
  }],

  // Decklist block fields
  // title: String, (already defined above)
  deckId: String, // Deck public ID to fetch from API (preferred)
  sections: String, // JSON string of deck sections (for manual entry)
  exportUrl: String,
  notes: String,
}, { _id: false });

// ============================================================================
// Article Interface and Schema
// ============================================================================

export interface IArticle extends Document {
  title: string;
  subtitle?: string;
  publicId: string;  // URL-safe unique identifier for external use
  slug: string;
  content: string;
  authorId: mongoose.Schema.Types.ObjectId;
  status: 'draft' | 'published';
  contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament';
  categories?: string[];  // Additional classifications: 'tournament', 'strategy', 'beginner', etc.
  image?: string;
  sections: any[];
  isUserArticle: boolean;  // true = user-managed, false = admin-managed
  // Hero guide specific fields (optional, used when contentType is 'hero')
  heroSlug?: string;   // e.g., 'rhinar-reckless-rampage' - matches HERO_INFO keys (lowercase)
  heroClass?: string;  // e.g., 'brute' - the hero's class for filtering
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  // PRIMARY URL identifier for all article routes (e.g., /articles/{publicId})
  publicId: { type: String, required: true, unique: true, index: true },
  // DEPRECATED as of 2026-02: Kept for backward compatibility only.
  // New articles do not generate slugs. Use publicId for all new functionality.
  slug: { type: String, required: false, unique: true, sparse: true, index: true, lowercase: true, trim: true },
  contentType: { type: String, enum: ['hero', 'article', 'guide', 'news', 'strategy', 'tournament'], required: true },
  categories: [{ type: String, trim: true, lowercase: true }], // Additional tags: 'tournament', 'strategy', 'beginner', etc.
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  image: { type: String },
  content: { type: String, default: '' }, // Keep this for compatibility
  sections: [SectionSchema],
  isUserArticle: { type: Boolean, default: false, index: true }, // true = user-managed, false = admin-managed
  // Hero guide specific fields (for filtering hero guides by class/hero)
  heroSlug: { type: String, lowercase: true, trim: true, index: true },
  heroClass: { type: String, lowercase: true, trim: true, index: true },
}, { timestamps: true });

// Add composite index for efficient user article queries
ArticleSchema.index({ isUserArticle: 1, authorId: 1, status: 1 });

export default mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);
// import mongoose, { Schema, Document } from 'mongoose';

// // ============================================================================
// // Define the "Shape" of Each Content Block
// // ============================================================================

// const TextSectionSchema = new Schema({
//   // No 'type' field needed here, it's handled by the discriminator
//   content: { type: String, required: true }, // The raw Markdown content
// }, { _id: false });

// const CardCarouselSectionSchema = new Schema({
//   cards: [{
//     _id: false, // Don't give each card an _id
//     printingId: { type: String, required: true },
//     caption: String,
//   }],
// }, { _id: false });

// const FeaturedVideoSectionSchema = new Schema({
//   videoId: { type: String, required: true },
//   title: String,
//   description: String,
//   creatorName: String,
//   creatorUrl: String,
// }, { _id: false });

// const CreatorSpotlightSectionSchema = new Schema({
//   imageUrl: String,
//   name: { type: String, required: true },
//   description: { type: String, required: true },
//   links: [{
//     _id: false,
//     label: { type: String, required: true },
//     url: { type: String, required: true },
//     icon: String,
//   }],
// }, { _id: false });

// const CalloutSectionSchema = new Schema({
//   title: String,
//   text: String,
//   linkHref: String,
//   linkText: String,
// }, { _id: false });

// const OpportunityCardSectionSchema = new Schema({
//   printingId: { type: String, required: true },
//   reason: { type: String, enum: ['underpriced', 'trending', 'supply-issue', 'correction', 'outlier'], required: true },
//   confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
//   priceChange: {
//     old: Number,
//     new: Number,
//     percentage: Number,
//   },
//   note: String,
// }, { _id: false });


// // ============================================================================
// // The Main Article Schema
// // ============================================================================

// export interface IArticle extends Document {
//   title: string;
//   subtitle?: string;
//   slug: string;
//   content: string;
//   authorId: mongoose.Schema.Types.ObjectId;
//   status: 'draft' | 'published';
//   contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy';
//   image?: string; // For the main OG image
//   sections: any[]; // The array of content blocks
//   createdAt: Date;
//   updatedAt: Date;
// }

// const ArticleSchema = new Schema<IArticle>({
//   // --- Metadata ---
//   title: { type: String, required: true, trim: true },
//   subtitle: { type: String, trim: true },
//   slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
//   contentType: { type: String, enum: ['hero', 'article'], required: true },
//   authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//   status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
//   image: { type: String }, // For the main social card image

//   // --- The Flexible Content Area ---
//   sections: [new Schema({
//     type: { type: String, required: true, enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'callout', 'opportunity-card'] }
//   }, { discriminatorKey: 'type', _id: false })],

// }, { timestamps: true });

// // --- Register the different block types with Mongoose ---
// const ArticleSectionsArray = ArticleSchema.path('sections') as any;
// ArticleSectionsArray.discriminator('text', TextSectionSchema);
// ArticleSectionsArray.discriminator('card-carousel', CardCarouselSectionSchema);
// ArticleSectionsArray.discriminator('video', FeaturedVideoSectionSchema);
// ArticleSectionsArray.discriminator('creator-spotlight', CreatorSpotlightSectionSchema);
// ArticleSectionsArray.discriminator('callout', CalloutSectionSchema);
// ArticleSectionsArray.discriminator('opportunity-card', OpportunityCardSectionSchema);


// export default mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);

// // Step 2: How This Model Scales for Future Components
// // This is the most beautiful part of the design. Let's say in the future you create a new React component called <QuoteBlock quote="some text..." author="someone" />.
// // To make this a manageable content block, you would simply:
// // Define its shape: Add a new schema to Article.ts:
// // code
// // TypeScript
// // const QuoteSectionSchema = new Schema({
// //   quote: { type: String, required: true },
// //   author: String,
// // }, { _id: false });
// // Register it: Add two lines to Article.ts:
// // code
// // TypeScript
// // // Add 'quote' to the list of allowed types
// // // ... enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'quote'] ...

// // // Register the new discriminator
// // ArticleSectionsArray.discriminator('quote', QuoteSectionSchema);
// // Update your renderer: In your [slug]/page.tsx, add a new case to your switch statement to render the <QuoteBlock> component.
// // That's it. Your database and backend are now ready to handle your new component. The system is built to grow.
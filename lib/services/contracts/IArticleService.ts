// lib/services/contracts/IArticleService.ts
import type { AsyncResult } from './common';

// ============================================================================
// Content Types
// ============================================================================

export type ArticleContentType = 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament';
export type ArticleStatus = 'draft' | 'published';

// ============================================================================
// Section Types (7 types)
// ============================================================================

export type ArticleSectionType =
  | 'text'
  | 'card-carousel'
  | 'video'
  | 'creator-spotlight'
  | 'callout'
  | 'opportunity-card'
  | 'spotlight-card';

// Text Section
export interface TextSectionDTO {
  type: 'text';
  content: string;
}

// Card Carousel Section
export interface CarouselCardDTO {
  printingId: string;
  caption?: string;
}

export interface CardCarouselSectionDTO {
  type: 'card-carousel';
  cards: CarouselCardDTO[];
}

// Video Section
export interface VideoSectionDTO {
  type: 'video';
  videoId: string;
  title: string;
  description?: string;
  creatorName?: string;
  creatorUrl?: string;
}

// Creator Spotlight Section
export interface CreatorLinkDTO {
  label: string;
  url: string;
  icon?: string;
}

export interface CreatorSpotlightSectionDTO {
  type: 'creator-spotlight';
  imageUrl: string;
  name: string;
  description?: string;
  links?: CreatorLinkDTO[];
}

// Callout Section
export interface CalloutSectionDTO {
  type: 'callout';
  title: string;
  text: string;
  linkHref?: string;
  linkText?: string;
}

// Opportunity Card Section
export type OpportunityReason = 'underpriced' | 'trending' | 'supply-issue' | 'correction' | 'outlier';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PriceChangeDTO {
  old: number;
  new: number;
  percentage?: number;
}

export interface OpportunityCardSectionDTO {
  type: 'opportunity-card';
  printingId: string;
  reason: OpportunityReason;
  confidence: ConfidenceLevel;
  priceChange?: PriceChangeDTO;
  note?: string;
}

// Spotlight Card Section
export interface SpotlightCardSectionDTO {
  type: 'spotlight-card';
  printingId: string;
  title: string;
  commentary?: string;
}

// Union of all section types
export type ArticleSectionDTO =
  | TextSectionDTO
  | CardCarouselSectionDTO
  | VideoSectionDTO
  | CreatorSpotlightSectionDTO
  | CalloutSectionDTO
  | OpportunityCardSectionDTO
  | SpotlightCardSectionDTO;

// ============================================================================
// Article DTOs
// ============================================================================

export interface ArticleDTO {
  _id?: string;
  title: string;
  subtitle?: string;
  publicId: string;    // URL-safe unique identifier for external use
  slug: string;
  content?: string;
  authorId: string;
  authorName?: string;
  status: ArticleStatus;
  contentType: ArticleContentType;
  categories?: string[];  // Additional classifications: 'tournament', 'strategy', 'beginner', etc.
  image?: string;
  sections: ArticleSectionDTO[];
  isUserArticle?: boolean;  // true = user-managed, false = admin-managed
  promoted?: boolean;       // true = admin has promoted this user article to featured placement
  // Hero guide specific fields (used when contentType is 'hero')
  heroSlug?: string;   // e.g., 'rhinar, reckless rampage' - matches HERO_INFO keys
  heroClass?: string;  // e.g., 'brute' - the hero's class for filtering
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateArticleDTO {
  title: string;
  subtitle?: string;
  /** @deprecated Slug deprecated as of 2026-02. New articles should not include slug (use publicId for routing). */
  slug?: string;
  contentType: ArticleContentType;
  image?: string;
  sections?: ArticleSectionDTO[];
  status?: ArticleStatus;
  // Hero guide specific fields
  heroSlug?: string;
  heroClass?: string;
}

export interface UpdateArticleDTO {
  title?: string;
  subtitle?: string;
  slug?: string;
  contentType?: ArticleContentType;
  categories?: string[];
  image?: string;
  status?: ArticleStatus;
  sections?: any[]; // Supports all section types including match-report, decklist-block, etc.
  // Hero guide specific fields
  heroSlug?: string;
  heroClass?: string;
  promoted?: boolean;  // Admin only: promote/demote a user article
}

export interface UpdateArticleOptions {
  /** Skip ownership check (for superadmins) */
  skipOwnershipCheck?: boolean;
}

// ============================================================================
// User Article DTOs (for regular user-created articles)
// ============================================================================

export interface CreateUserArticleDTO {
  title: string;
  subtitle?: string;
  // slug removed - user articles use publicId only (generated on creation)
  contentType: 'hero' | 'tournament' | 'strategy';  // Restricted for users; 'article' is admin-only
  image?: string;
  sections?: any[];  // All 13 section types allowed
  status?: ArticleStatus;
  // Hero guide specific fields
  heroClass?: string;
  heroSlug?: string;
}

export interface UpdateUserArticleDTO {
  title?: string;
  subtitle?: string;
  status?: ArticleStatus;
  contentType?: ArticleContentType;  // Editable until publish — quick-write defers metadata to publish time
  image?: string;
  sections?: any[];  // All 13 section types allowed
  // Hero guide specific fields
  heroClass?: string;
  heroSlug?: string;
}

export interface UserArticleListFilters extends ArticleListFilters {
  isUserArticle: true;  // Always forced to true for user article queries
}

// ============================================================================
// Filters and Options
// ============================================================================

export interface ArticleListFilters {
  status?: ArticleStatus;
  contentType?: ArticleContentType;
  authorId?: string;
  slug?: string;
  isUserArticle?: boolean;  // Filter by user-created vs admin-created
  // Hero guide specific filters
  heroSlug?: string;
  heroClass?: string;
}

export interface ArticleListOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

// ============================================================================
// Export/Import DTOs
// ============================================================================

export interface ArticleExportDTO {
  title: string;
  subtitle?: string;
  slug: string;
  contentType: ArticleContentType;
  status: ArticleStatus;
  image?: string;
  sections: ArticleSectionDTO[];
  exportedAt: Date;
  originalAuthorId?: string;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface SectionValidationResult {
  valid: boolean;
  errors: string[];
  sectionIndex?: number;
}

// ============================================================================
// IArticleService Interface
// ============================================================================

export interface IArticleService {
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new article
   * @param authorId - The ID of the author creating the article
   * @param data - Article creation data
   * @returns The created article
   */
  createArticle(authorId: string, data: CreateArticleDTO): AsyncResult<ArticleDTO>;

  /**
   * Get an article by ID or slug
   * @param idOrSlug - MongoDB ObjectId or slug
   * @returns The article or null if not found
   */
  getArticle(idOrSlug: string): AsyncResult<ArticleDTO | null>;

  /**
   * Get an article by MongoDB ID
   * @param id - MongoDB ObjectId
   * @returns The article or null if not found
   */
  getArticleById(id: string): AsyncResult<ArticleDTO | null>;

  /**
   * Get an article by slug
   * @param slug - Article slug
   * @returns The article or null if not found
   * @deprecated Use getArticleByPublicId() instead. Slug field deprecated as of 2026-02.
   */
  getArticleBySlug(slug: string): AsyncResult<ArticleDTO | null>;

  /**
   * Get an article by publicId
   * @param publicId - Article public ID
   * @returns The article or null if not found
   */
  getArticleByPublicId(publicId: string): AsyncResult<ArticleDTO | null>;

  /**
   * Update article metadata (not sections)
   * @param id - Article ID
   * @param userId - User performing the update (for authorization)
   * @param updates - Fields to update
   * @param options - Optional settings like skipOwnershipCheck for superadmins
   * @returns The updated article
   */
  updateArticle(id: string, userId: string, updates: UpdateArticleDTO, options?: UpdateArticleOptions): AsyncResult<ArticleDTO>;

  /**
   * Delete an article
   * @param id - Article ID
   * @param userId - User performing deletion (for authorization)
   * @returns True if deleted
   */
  deleteArticle(id: string, userId: string): AsyncResult<boolean>;

  // ============================================================================
  // List Operations
  // ============================================================================

  /**
   * List articles with filters and pagination
   * @param filters - Filter criteria
   * @param options - Pagination and sorting options
   * @returns Articles array and total count
   */
  listArticles(
    filters: ArticleListFilters,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }>;

  /**
   * Count articles matching filters
   * @param filters - Filter criteria
   * @returns Count of matching articles
   */
  countArticles(filters: ArticleListFilters): AsyncResult<number>;

  // ============================================================================
  // Section Management
  // ============================================================================

  /**
   * Append a section to the end of the article
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param section - Section to append
   * @returns Updated article
   */
  appendSection(id: string, userId: string, section: ArticleSectionDTO): AsyncResult<ArticleDTO>;

  /**
   * Append multiple sections to the end of the article
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param sections - Sections to append
   * @returns Updated article
   */
  appendSections(id: string, userId: string, sections: ArticleSectionDTO[]): AsyncResult<ArticleDTO>;

  /**
   * Insert a section at a specific index
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param section - Section to insert
   * @param index - Position to insert at
   * @returns Updated article
   */
  insertSection(id: string, userId: string, section: ArticleSectionDTO, index: number): AsyncResult<ArticleDTO>;

  /**
   * Update a section at a specific index
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param section - New section data
   * @param index - Index of section to update
   * @returns Updated article
   */
  updateSection(id: string, userId: string, section: ArticleSectionDTO, index: number): AsyncResult<ArticleDTO>;

  /**
   * Delete a section by index
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param index - Index of section to delete
   * @returns Updated article
   */
  deleteSection(id: string, userId: string, index: number): AsyncResult<ArticleDTO>;

  // ============================================================================
  // Publishing
  // ============================================================================

  /**
   * Update article status (draft/published)
   * @param id - Article ID
   * @param userId - User performing the operation
   * @param status - New status
   * @returns Updated article
   */
  updateStatus(id: string, userId: string, status: ArticleStatus): AsyncResult<ArticleDTO>;

  /**
   * Get all published articles, optionally filtered by content type
   * @param contentType - Optional content type filter
   * @returns Array of published articles
   */
  getPublishedArticles(contentType?: ArticleContentType): AsyncResult<ArticleDTO[]>;

  /**
   * Get slugs of all published articles (for static generation)
   * @param contentType - Optional content type filter
   * @returns Array of slugs
   * @deprecated Use getPublishedArticlePublicIds() instead. Slug field deprecated as of 2026-02.
   */
  getPublishedArticleSlugs(contentType?: ArticleContentType): AsyncResult<string[]>;

  /**
   * Get public IDs of all published articles (for static generation)
   * @param contentType - Optional content type filter
   * @returns Array of public IDs
   */
  getPublishedArticlePublicIds(contentType?: ArticleContentType): AsyncResult<string[]>;

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export an article to clean JSON format
   * @param idOrSlug - Article ID or slug
   * @returns Export data without MongoDB-specific fields
   */
  exportArticle(idOrSlug: string): AsyncResult<ArticleExportDTO>;

  /**
   * Import an article from exported JSON
   * @param authorId - ID of the user importing (becomes the author)
   * @param data - Exported article data
   * @returns The created article
   */
  importArticle(authorId: string, data: ArticleExportDTO): AsyncResult<ArticleDTO>;

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Check if a slug already exists
   * @param slug - Slug to check
   * @param excludeId - Optional article ID to exclude (for updates)
   * @returns True if slug exists
   * @deprecated Slug validation no longer needed for new articles. Kept for backward compatibility only.
   */
  slugExists(slug: string, excludeId?: string): AsyncResult<boolean>;

  /**
   * Validate a section's structure and required fields
   * @param section - Section to validate
   * @returns Validation result with any errors
   */
  validateSection(section: ArticleSectionDTO): AsyncResult<SectionValidationResult>;

  /**
   * Validate all sections in an article
   * @param sections - Array of sections to validate
   * @returns Validation results for each section
   */
  validateSections(sections: ArticleSectionDTO[]): AsyncResult<SectionValidationResult[]>;

  // ============================================================================
  // User Article Operations
  // ============================================================================

  /**
   * Create a user-owned article (with rate limiting)
   * @param userId - User creating the article
   * @param data - Article creation data (limited contentTypes)
   * @returns Created article with isUserArticle: true
   */
  createUserArticle(userId: string, data: CreateUserArticleDTO): AsyncResult<ArticleDTO>;

  /**
   * Get articles created by a specific user
   * @param userId - User ID to filter by
   * @param filters - Additional filters (status, contentType)
   * @param options - Pagination and sorting
   * @returns User's articles and total count
   */
  getUserArticles(
    userId: string,
    filters?: Partial<UserArticleListFilters>,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }>;

  /**
   * Update a user article (with ownership check)
   * @param articleId - Article ID
   * @param userId - User performing update (must be owner)
   * @param updates - Fields to update
   * @returns Updated article
   */
  updateUserArticle(articleId: string, userId: string, updates: UpdateUserArticleDTO): AsyncResult<ArticleDTO>;

  /**
   * Delete a user article (with ownership check)
   * @param articleId - Article ID
   * @param userId - User performing deletion (must be owner)
   * @returns True if deleted
   */
  deleteUserArticle(articleId: string, userId: string): AsyncResult<boolean>;

  /**
   * Check if user has exceeded daily article creation limit
   * @param userId - User ID to check
   * @returns Count of articles created today and whether limit is reached
   */
  checkUserArticleRateLimit(userId: string): AsyncResult<{ count: number; limitReached: boolean; limit: number }>;

  /**
   * Promote or demote a user article (admin only)
   * @param articleId - Article ID or publicId
   * @param adminId - Admin user performing the action
   * @param promoted - Whether to promote (true) or demote (false)
   * @returns Updated article
   */
  promoteArticle(articleId: string, adminId: string, promoted: boolean): AsyncResult<ArticleDTO>;
}

/**
 * MongoDB implementation of IArticleService
 *
 * Provides article CRUD, section management, publishing, and import/export operations.
 */

import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import connectToDatabase from '@/lib/mongodb';
import type {
  IArticleService,
  ArticleDTO,
  CreateArticleDTO,
  UpdateArticleDTO,
  CreateUserArticleDTO,
  UpdateUserArticleDTO,
  UserArticleListFilters,
  ArticleSectionDTO,
  ArticleListFilters,
  ArticleListOptions,
  ArticleExportDTO,
  ArticleStatus,
  ArticleContentType,
  SectionValidationResult,
} from '../../contracts/IArticleService';
import type { AsyncResult } from '../../contracts/common';

export class MongoArticleService implements IArticleService {
  // User article constraints
  private readonly USER_ALLOWED_CONTENT_TYPES: ArticleContentType[] = [
    'article',
    'strategy',
    'hero',
    'guide',
    'tournament'
  ];
  private readonly USER_DAILY_ARTICLE_LIMIT = 3;

  /**
   * Ensure database connection is established
   */
  private async ensureConnection() {
    await connectToDatabase();
  }

  /**
   * Get Article model (lazy import to avoid circular dependencies)
   */
  private async getArticleModel() {
    const Article = (await import('@/models/Article')).default;
    return Article;
  }

  /**
   * Convert Mongoose document to ArticleDTO
   */
  private toDTO(article: any): ArticleDTO {
    return {
      _id: article._id?.toString(),
      title: article.title,
      subtitle: article.subtitle,
      publicId: article.publicId,
      slug: article.slug,
      content: article.content,
      authorId: article.authorId?.toString(),
      authorName: article.authorName,
      status: article.status,
      contentType: article.contentType,
      categories: article.categories || [],
      image: article.image,
      sections: article.sections || [],
      isUserArticle: article.isUserArticle || false,
      heroSlug: article.heroSlug,
      heroClass: article.heroClass,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  /**
   * Check if a string is a valid MongoDB ObjectId
   */
  private isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new article
   *
   * NOTE: Slug field is DEPRECATED as of 2026-02.
   * - Kept for backward compatibility with existing articles only
   * - New articles should not include slug (publicId is used for routing)
   * - If slug is provided, it will be validated and saved for admin use only
   */
  async createArticle(
    authorId: string,
    data: CreateArticleDTO
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      // If slug is provided (legacy/admin use), check if it already exists
      if (data.slug) {
        const existingArticle = await Article.findOne({ slug: data.slug });
        if (existingArticle) {
          return { success: false, error: 'An article with this slug already exists' };
        }
      }

      // Validate sections if provided
      if (data.sections && data.sections.length > 0) {
        const validationResults = await this.validateSections(data.sections);
        if (validationResults.success) {
          const invalidSections = validationResults.data.filter(r => !r.valid);
          if (invalidSections.length > 0) {
            const errors = invalidSections.map(s =>
              `Section ${s.sectionIndex}: ${s.errors.join(', ')}`
            ).join('; ');
            return { success: false, error: `Invalid sections: ${errors}` };
          }
        }
      }

      // Generate unique publicId (10 characters for good collision resistance)
      let publicId = nanoid(10);
      let publicIdExists = await Article.exists({ publicId });

      // Extremely unlikely, but regenerate if collision occurs
      while (publicIdExists) {
        publicId = nanoid(10);
        publicIdExists = await Article.exists({ publicId });
      }

      const articleData: any = {
        title: data.title.trim(),
        subtitle: data.subtitle?.trim(),
        publicId,
        contentType: data.contentType,
        image: data.image,
        sections: data.sections || [],
        status: data.status || 'draft',
        authorId: new mongoose.Types.ObjectId(authorId),
        content: '', // Legacy field
        heroSlug: data.heroSlug?.toLowerCase().trim(),
        heroClass: data.heroClass?.toLowerCase().trim(),
      };

      // Only include slug if explicitly provided (backward compatibility)
      if (data.slug) {
        articleData.slug = data.slug.toLowerCase().trim();
      }

      const newArticle = new Article(articleData);

      await newArticle.save();

      return { success: true, data: this.toDTO(newArticle) };
    } catch (error) {
      console.error('[MongoArticleService.createArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create article',
      };
    }
  }

  /**
   * Get an article by ID, publicId, or slug
   */
  async getArticle(idOrSlugOrPublicId: string): AsyncResult<ArticleDTO | null> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      let article;

      // Try to find by ObjectId first
      if (this.isValidObjectId(idOrSlugOrPublicId)) {
        article = await Article.findById(idOrSlugOrPublicId);
      }

      // If not found, try by publicId
      if (!article) {
        article = await Article.findOne({ publicId: idOrSlugOrPublicId });
      }

      // If still not found, try by slug
      if (!article) {
        article = await Article.findOne({ slug: idOrSlugOrPublicId.toLowerCase() });
      }

      if (!article) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.getArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article',
      };
    }
  }

  /**
   * Get an article by MongoDB ID
   */
  async getArticleById(id: string): AsyncResult<ArticleDTO | null> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: true, data: null };
      }

      // Use .lean() to get a plain JavaScript object without Mongoose overhead
      const article = await Article.findById(id).lean();

      if (!article) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.getArticleById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by ID',
      };
    }
  }

  /**
   * Get an article by slug
   */
  async getArticleBySlug(slug: string): AsyncResult<ArticleDTO | null> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const article = await Article.findOne({ slug: slug.toLowerCase() });

      if (!article) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.getArticleBySlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by slug',
      };
    }
  }

  async getArticleByPublicId(publicId: string): AsyncResult<ArticleDTO | null> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const article = await Article.findOne({ publicId });

      if (!article) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.getArticleByPublicId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by publicId',
      };
    }
  }

  /**
   * Update article metadata (not sections)
   */
  async updateArticle(
    id: string,
    userId: string,
    updates: UpdateArticleDTO,
    options?: { skipOwnershipCheck?: boolean }
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check ownership (unless skipped for superadmins)
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (!options?.skipOwnershipCheck && existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to update this article' };
      }

      // If slug is being changed, check uniqueness
      if (updates.slug && updates.slug !== existingArticle.slug) {
        const slugExists = await Article.findOne({
          slug: updates.slug.toLowerCase(),
          _id: { $ne: id },
        });
        if (slugExists) {
          return { success: false, error: 'An article with this slug already exists' };
        }
      }

      const updateFields: any = { updatedAt: new Date() };
      if (updates.title !== undefined) updateFields.title = updates.title.trim();
      if (updates.subtitle !== undefined) updateFields.subtitle = updates.subtitle?.trim();
      if (updates.slug !== undefined) updateFields.slug = updates.slug.toLowerCase().trim();
      if (updates.contentType !== undefined) updateFields.contentType = updates.contentType;
      if (updates.categories !== undefined) updateFields.categories = updates.categories;
      if (updates.image !== undefined) updateFields.image = updates.image;
      if (updates.status !== undefined) updateFields.status = updates.status;
      if (updates.sections !== undefined) updateFields.sections = updates.sections;
      if (updates.heroSlug !== undefined) updateFields.heroSlug = updates.heroSlug?.toLowerCase().trim();
      if (updates.heroClass !== undefined) updateFields.heroClass = updates.heroClass?.toLowerCase().trim();

      const article = await Article.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.updateArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update article',
      };
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string, userId: string): AsyncResult<boolean> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to delete this article' };
      }

      await Article.findByIdAndDelete(id);

      return { success: true, data: true };
    } catch (error) {
      console.error('[MongoArticleService.deleteArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete article',
      };
    }
  }

  // ============================================================================
  // List Operations
  // ============================================================================

  /**
   * List articles with filters and pagination
   */
  async listArticles(
    filters: ArticleListFilters,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.contentType) query.contentType = filters.contentType;
      if (filters.authorId) query.authorId = new mongoose.Types.ObjectId(filters.authorId);
      if (filters.slug) query.slug = filters.slug.toLowerCase();
      if (filters.heroSlug) query.heroSlug = filters.heroSlug.toLowerCase();
      if (filters.heroClass) query.heroClass = filters.heroClass.toLowerCase();

      const total = await Article.countDocuments(query);

      let articlesQuery = Article.find(query);

      if (options?.sort) {
        articlesQuery = articlesQuery.sort(options.sort);
      } else {
        articlesQuery = articlesQuery.sort({ updatedAt: -1 });
      }

      if (options?.skip) articlesQuery = articlesQuery.skip(options.skip);
      if (options?.limit) articlesQuery = articlesQuery.limit(options.limit);

      const articles = await articlesQuery.exec();

      return {
        success: true,
        data: {
          articles: articles.map((a: any) => this.toDTO(a)),
          total,
        },
      };
    } catch (error) {
      console.error('[MongoArticleService.listArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list articles',
      };
    }
  }

  /**
   * Count articles matching filters
   */
  async countArticles(filters: ArticleListFilters): AsyncResult<number> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.contentType) query.contentType = filters.contentType;
      if (filters.authorId) query.authorId = new mongoose.Types.ObjectId(filters.authorId);
      if (filters.slug) query.slug = filters.slug.toLowerCase();
      if (filters.heroSlug) query.heroSlug = filters.heroSlug.toLowerCase();
      if (filters.heroClass) query.heroClass = filters.heroClass.toLowerCase();

      const count = await Article.countDocuments(query);

      return { success: true, data: count };
    } catch (error) {
      console.error('[MongoArticleService.countArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count articles',
      };
    }
  }

  // ============================================================================
  // Section Management
  // ============================================================================

  /**
   * Append a section to the end of the article
   */
  async appendSection(
    id: string,
    userId: string,
    section: ArticleSectionDTO
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Validate section
      const validationResult = await this.validateSection(section);
      if (validationResult.success && !validationResult.data.valid) {
        return { success: false, error: `Invalid section: ${validationResult.data.errors.join(', ')}` };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $push: { sections: section },
          $set: { updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.appendSection] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append section',
      };
    }
  }

  /**
   * Append multiple sections to the end of the article
   */
  async appendSections(
    id: string,
    userId: string,
    sections: ArticleSectionDTO[]
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Validate all sections
      const validationResults = await this.validateSections(sections);
      if (validationResults.success) {
        const invalidSections = validationResults.data.filter(r => !r.valid);
        if (invalidSections.length > 0) {
          const errors = invalidSections.map(s =>
            `Section ${s.sectionIndex}: ${s.errors.join(', ')}`
          ).join('; ');
          return { success: false, error: `Invalid sections: ${errors}` };
        }
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $push: { sections: { $each: sections } },
          $set: { updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.appendSections] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append sections',
      };
    }
  }

  /**
   * Insert a section at a specific index
   */
  async insertSection(
    id: string,
    userId: string,
    section: ArticleSectionDTO,
    index: number
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Validate section
      const validationResult = await this.validateSection(section);
      if (validationResult.success && !validationResult.data.valid) {
        return { success: false, error: `Invalid section: ${validationResult.data.errors.join(', ')}` };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      // Insert at index
      const sections = existingArticle.sections || [];
      if (index < 0 || index > sections.length) {
        return { success: false, error: `Index ${index} is out of bounds` };
      }

      sections.splice(index, 0, section);

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $set: { sections, updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.insertSection] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to insert section',
      };
    }
  }

  /**
   * Update a section at a specific index
   */
  async updateSection(
    id: string,
    userId: string,
    section: ArticleSectionDTO,
    index: number
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Validate section
      const validationResult = await this.validateSection(section);
      if (validationResult.success && !validationResult.data.valid) {
        return { success: false, error: `Invalid section: ${validationResult.data.errors.join(', ')}` };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      // Update at index
      const sections = existingArticle.sections || [];
      if (index < 0 || index >= sections.length) {
        return { success: false, error: `Index ${index} is out of bounds` };
      }

      sections[index] = section;

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $set: { sections, updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.updateSection] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update section',
      };
    }
  }

  /**
   * Delete a section by index
   */
  async deleteSection(
    id: string,
    userId: string,
    index: number
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      // Delete at index
      const sections = existingArticle.sections || [];
      if (index < 0 || index >= sections.length) {
        return { success: false, error: `Index ${index} is out of bounds` };
      }

      sections.splice(index, 1);

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $set: { sections, updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.deleteSection] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete section',
      };
    }
  }

  // ============================================================================
  // Publishing
  // ============================================================================

  /**
   * Update article status (draft/published)
   */
  async updateStatus(
    id: string,
    userId: string,
    status: ArticleStatus
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(id)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check ownership
      const existingArticle = await Article.findById(id);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      const article = await Article.findByIdAndUpdate(
        id,
        {
          $set: { status, updatedAt: new Date() },
        },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.updateStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Get all published articles, optionally filtered by content type
   */
  async getPublishedArticles(
    contentType?: ArticleContentType
  ): AsyncResult<ArticleDTO[]> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = { status: 'published' };
      if (contentType) {
        query.contentType = contentType;
      }

      const articles = await Article.find(query).sort({ updatedAt: -1 });

      return {
        success: true,
        data: articles.map((a: any) => this.toDTO(a)),
      };
    } catch (error) {
      console.error('[MongoArticleService.getPublishedArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published articles',
      };
    }
  }

  /**
   * Get slugs of all published articles (for static generation)
   */
  async getPublishedArticleSlugs(
    contentType?: ArticleContentType
  ): AsyncResult<string[]> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = { status: 'published' };
      if (contentType) {
        query.contentType = contentType;
      }

      const articles = await Article.find(query).select('slug').lean();

      return {
        success: true,
        data: articles.map((a: any) => a.slug),
      };
    } catch (error) {
      console.error('[MongoArticleService.getPublishedArticleSlugs] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published article slugs',
      };
    }
  }

  /**
   * Get public IDs of all published articles (for static generation)
   */
  async getPublishedArticlePublicIds(
    contentType?: ArticleContentType
  ): AsyncResult<string[]> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = { status: 'published', publicId: { $exists: true, $ne: null } };
      if (contentType) {
        query.contentType = contentType;
      }

      const articles = await Article.find(query).select('publicId').lean();

      return {
        success: true,
        data: articles.map((a: any) => a.publicId).filter((id: string) => id != null),
      };
    } catch (error) {
      console.error('[MongoArticleService.getPublishedArticlePublicIds] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published article public IDs',
      };
    }
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export an article to clean JSON format
   */
  async exportArticle(idOrPublicId: string): AsyncResult<ArticleExportDTO> {
    try {
      // Enforce publicId-only (or MongoDB ObjectId for internal admin operations)
      // Slug parameter no longer supported as of 2026-02
      const articleResult = this.isValidObjectId(idOrPublicId)
        ? await this.getArticleById(idOrPublicId)
        : await this.getArticleByPublicId(idOrPublicId);

      if (!articleResult.success) {
        return { success: false, error: articleResult.error };
      }

      if (!articleResult.data) {
        return { success: false, error: 'Article not found' };
      }

      const article = articleResult.data;

      const exportData: ArticleExportDTO = {
        title: article.title,
        subtitle: article.subtitle,
        slug: article.slug,
        contentType: article.contentType,
        status: article.status,
        image: article.image,
        sections: article.sections,
        exportedAt: new Date(),
        originalAuthorId: article.authorId,
      };

      return { success: true, data: exportData };
    } catch (error) {
      console.error('[MongoArticleService.exportArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export article',
      };
    }
  }

  /**
   * Import an article from exported JSON
   */
  async importArticle(
    authorId: string,
    data: ArticleExportDTO
  ): AsyncResult<ArticleDTO> {
    try {
      // Generate unique slug if the original exists
      let slug = data.slug;
      const slugExistsResult = await this.slugExists(slug);
      if (slugExistsResult.success && slugExistsResult.data) {
        // Append timestamp to make unique
        slug = `${slug}-${Date.now()}`;
      }

      const createResult = await this.createArticle(authorId, {
        title: data.title,
        subtitle: data.subtitle,
        slug,
        contentType: data.contentType,
        image: data.image,
        sections: data.sections,
        status: 'draft', // Always import as draft
      });

      return createResult;
    } catch (error) {
      console.error('[MongoArticleService.importArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import article',
      };
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Check if a slug already exists
   */
  async slugExists(slug: string, excludeId?: string): AsyncResult<boolean> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      const query: any = { slug: slug.toLowerCase() };
      if (excludeId && this.isValidObjectId(excludeId)) {
        query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
      }

      const exists = await Article.exists(query);

      return { success: true, data: !!exists };
    } catch (error) {
      console.error('[MongoArticleService.slugExists] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check slug',
      };
    }
  }

  /**
   * Validate a section's structure and required fields
   */
  async validateSection(
    section: ArticleSectionDTO
  ): AsyncResult<SectionValidationResult> {
    const errors: string[] = [];

    if (!section.type) {
      errors.push('Section type is required');
      return { success: true, data: { valid: false, errors } };
    }

    const validTypes = [
      'text',
      'card-carousel',
      'video',
      'creator-spotlight',
      'callout',
      'opportunity-card',
      'spotlight-card',
      'intro',
      'byline',
      'section-header',
      'key-takeaways',
      'match-report',
      'decklist-block',
    ];

    if (!validTypes.includes(section.type)) {
      errors.push(`Invalid section type: ${section.type}`);
      return { success: true, data: { valid: false, errors } };
    }

    // Type-specific validation
    switch (section.type) {
      case 'text':
        if (!section.content || typeof section.content !== 'string') {
          errors.push('Text section requires content');
        }
        break;

      case 'card-carousel':
        if (!section.cards || !Array.isArray(section.cards) || section.cards.length === 0) {
          errors.push('Card carousel section requires at least one card');
        } else {
          section.cards.forEach((card, i) => {
            if (!card.printingId) {
              errors.push(`Card ${i + 1} requires printingId`);
            }
          });
        }
        break;

      case 'video':
        if (!section.videoId) {
          errors.push('Video section requires videoId');
        }
        if (!section.title) {
          errors.push('Video section requires title');
        }
        break;

      case 'creator-spotlight':
        if (!section.name) {
          errors.push('Creator spotlight section requires name');
        }
        if (section.links && Array.isArray(section.links)) {
          section.links.forEach((link, i) => {
            if (!link.label) {
              errors.push(`Link ${i + 1} requires label`);
            }
            if (!link.url) {
              errors.push(`Link ${i + 1} requires url`);
            }
          });
        }
        break;

      case 'callout':
        if (!section.title) {
          errors.push('Callout section requires title');
        }
        if (!section.text) {
          errors.push('Callout section requires text');
        }
        break;

      case 'opportunity-card':
        if (!section.printingId) {
          errors.push('Opportunity card section requires printingId');
        }
        if (!section.reason) {
          errors.push('Opportunity card section requires reason');
        }
        if (!section.confidence) {
          errors.push('Opportunity card section requires confidence');
        }
        break;

      case 'spotlight-card':
        if (!section.printingId) {
          errors.push('Spotlight card section requires printingId');
        }
        if (!section.title) {
          errors.push('Spotlight card section requires title');
        }
        break;

      case 'intro':
        if (!section.text) {
          errors.push('Intro section requires text');
        }
        break;

      case 'byline':
        if (!section.name) {
          errors.push('Byline section requires name');
        }
        break;

      case 'section-header':
        if (!section.title) {
          errors.push('Section header requires title');
        }
        break;

      case 'key-takeaways':
        // Items can be empty
        break;

      case 'match-report':
        if (!section.hero) {
          errors.push('Match report requires opponent hero');
        }
        break;

      case 'decklist-block':
        // Sections can be empty initially
        break;
    }

    return {
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
      },
    };
  }

  /**
   * Validate all sections in an article
   */
  async validateSections(
    sections: ArticleSectionDTO[]
  ): AsyncResult<SectionValidationResult[]> {
    const results: SectionValidationResult[] = [];

    for (let i = 0; i < sections.length; i++) {
      const validationResult = await this.validateSection(sections[i]);
      if (validationResult.success) {
        results.push({
          ...validationResult.data,
          sectionIndex: i,
        });
      } else {
        results.push({
          valid: false,
          errors: [validationResult.error || 'Unknown validation error'],
          sectionIndex: i,
        });
      }
    }

    return { success: true, data: results };
  }

  // ============================================================================
  // User Article Operations
  // ============================================================================

  /**
   * Check if user has exceeded daily article creation limit
   */
  async checkUserArticleRateLimit(
    userId: string
  ): AsyncResult<{ count: number; limitReached: boolean; limit: number }> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      // Get start of today (midnight UTC)
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      // Count articles created by user today
      const count = await Article.countDocuments({
        authorId: new mongoose.Types.ObjectId(userId),
        isUserArticle: true,
        createdAt: { $gte: startOfToday },
      });

      return {
        success: true,
        data: {
          count,
          limitReached: count >= this.USER_DAILY_ARTICLE_LIMIT,
          limit: this.USER_DAILY_ARTICLE_LIMIT,
        },
      };
    } catch (error) {
      console.error('[MongoArticleService.checkUserArticleRateLimit] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check rate limit',
      };
    }
  }

  /**
   * Create a user-owned article (with rate limiting and validation)
   *
   * NOTE: Slug field is DEPRECATED as of 2026-02.
   * - User articles do NOT generate slugs (publicId is used for routing)
   * - Kept for backward compatibility in admin articles only
   */
  async createUserArticle(
    userId: string,
    data: CreateUserArticleDTO
  ): AsyncResult<ArticleDTO> {
    try {
      // Check rate limit
      const rateLimitResult = await this.checkUserArticleRateLimit(userId);
      if (!rateLimitResult.success) {
        return { success: false, error: rateLimitResult.error };
      }

      if (rateLimitResult.data.limitReached) {
        return {
          success: false,
          error: `Daily article limit reached (${this.USER_DAILY_ARTICLE_LIMIT} articles per day). Try again tomorrow.`,
        };
      }

      // Validate contentType
      if (!this.USER_ALLOWED_CONTENT_TYPES.includes(data.contentType)) {
        return {
          success: false,
          error: `Invalid content type. Users can only create: ${this.USER_ALLOWED_CONTENT_TYPES.join(', ')}`,
        };
      }

      // Validate sections if provided (all 13 types are allowed for users)
      if (data.sections && data.sections.length > 0) {
        const validationResults = await this.validateSections(data.sections);
        if (validationResults.success) {
          const invalidSections = validationResults.data.filter(r => !r.valid);
          if (invalidSections.length > 0) {
            const errors = invalidSections.map(s =>
              `Section ${s.sectionIndex !== undefined ? s.sectionIndex + 1 : '?'}: ${s.errors.join(', ')}`
            ).join('; ');
            return { success: false, error: `Invalid sections: ${errors}` };
          }
        }
      }

      await this.ensureConnection();
      const Article = await this.getArticleModel();

      // Generate publicId
      const publicId = nanoid(10);

      // Create article with isUserArticle: true
      // NOTE: Slug is DEPRECATED for user articles - do not include
      const article = await Article.create({
        title: data.title,
        subtitle: data.subtitle,
        publicId,
        contentType: data.contentType,
        image: data.image,
        authorId: new mongoose.Types.ObjectId(userId),
        status: data.status || 'draft',
        sections: data.sections || [],
        isUserArticle: true, // Mark as user-created
      });

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.createUserArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user article',
      };
    }
  }

  /**
   * Get articles created by a specific user
   */
  async getUserArticles(
    userId: string,
    filters?: Partial<UserArticleListFilters>,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      // Force isUserArticle and authorId filters
      const query: any = {
        isUserArticle: true,
        authorId: new mongoose.Types.ObjectId(userId),
      };

      // Apply additional filters
      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.contentType) {
        query.contentType = filters.contentType;
      }

      if (filters?.slug) {
        query.slug = filters.slug;
      }

      // Get total count
      const total = await Article.countDocuments(query);

      // Apply pagination and sorting
      let queryBuilder = Article.find(query);

      if (options?.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
      } else {
        queryBuilder = queryBuilder.sort({ updatedAt: -1 }); // Default sort by updatedAt desc
      }

      if (options?.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
      }

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const articles = await queryBuilder.lean();

      return {
        success: true,
        data: {
          articles: articles.map((a: any) => this.toDTO(a)),
          total,
        },
      };
    } catch (error) {
      console.error('[MongoArticleService.getUserArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user articles',
      };
    }
  }

  /**
   * Update a user article (with ownership check)
   */
  async updateUserArticle(
    articleId: string,
    userId: string,
    updates: UpdateUserArticleDTO
  ): AsyncResult<ArticleDTO> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(articleId)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check article exists and verify ownership
      const existingArticle = await Article.findById(articleId);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (!existingArticle.isUserArticle) {
        return { success: false, error: 'This is not a user article' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to modify this article' };
      }

      // Validate sections if provided
      if (updates.sections && updates.sections.length > 0) {
        const validationResults = await this.validateSections(updates.sections);
        if (validationResults.success) {
          const invalidSections = validationResults.data.filter(r => !r.valid);
          if (invalidSections.length > 0) {
            const errors = invalidSections.map(s =>
              `Section ${s.sectionIndex !== undefined ? s.sectionIndex + 1 : '?'}: ${s.errors.join(', ')}`
            ).join('; ');
            return { success: false, error: `Invalid sections: ${errors}` };
          }
        }
      }

      // Build update object
      const updateFields: any = { updatedAt: new Date() };

      if (updates.title !== undefined) updateFields.title = updates.title;
      if (updates.subtitle !== undefined) updateFields.subtitle = updates.subtitle;
      if (updates.status !== undefined) updateFields.status = updates.status;
      if (updates.image !== undefined) updateFields.image = updates.image;
      if (updates.sections !== undefined) updateFields.sections = updates.sections;

      const article = await Article.findByIdAndUpdate(
        articleId,
        { $set: updateFields },
        { new: true }
      );

      if (!article) {
        return { success: false, error: 'Article not found' };
      }

      return { success: true, data: this.toDTO(article) };
    } catch (error) {
      console.error('[MongoArticleService.updateUserArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user article',
      };
    }
  }

  /**
   * Delete a user article (with ownership check)
   */
  async deleteUserArticle(
    articleId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();
      const Article = await this.getArticleModel();

      if (!this.isValidObjectId(articleId)) {
        return { success: false, error: 'Invalid article ID' };
      }

      // Check article exists and verify ownership
      const existingArticle = await Article.findById(articleId);
      if (!existingArticle) {
        return { success: false, error: 'Article not found' };
      }

      if (!existingArticle.isUserArticle) {
        return { success: false, error: 'This is not a user article' };
      }

      if (existingArticle.authorId.toString() !== userId) {
        return { success: false, error: 'Not authorized to delete this article' };
      }

      await Article.findByIdAndDelete(articleId);

      return { success: true, data: true };
    } catch (error) {
      console.error('[MongoArticleService.deleteUserArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user article',
      };
    }
  }
}

/**
 * PostgreSQL implementation of IArticleService
 *
 * Provides article CRUD, section management, publishing, and user-generated content.
 * Sections stored as JSONB for efficient querying.
 */

import { db } from '@/lib/postgres/db';
import { articles, users } from '@/lib/postgres/schema';
import { eq, and, sql, or, inArray, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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

export class PostgresArticleService implements IArticleService {
  // User article constraints
  private readonly USER_ALLOWED_CONTENT_TYPES: ArticleContentType[] = [
    'strategy',
    'hero',
    'tournament',
  ];
  private readonly USER_DAILY_ARTICLE_LIMIT = 3;

  /**
   * Convert database row to ArticleDTO
   */
  private toDTO(row: any): ArticleDTO {
    return {
      _id: row.id,
      title: row.title,
      subtitle: row.subtitle || undefined,
      publicId: row.publicId,
      slug: row.slug,
      content: row.content || undefined,
      authorId: row.authorId,
      authorName: row.authorName || undefined,
      status: row.status as ArticleStatus,
      contentType: row.contentType as ArticleContentType,
      categories: row.categories || [],
      image: row.image || undefined,
      sections: Array.isArray(row.sections) ? row.sections : [],
      isUserArticle: row.isUserArticle || false,
      promoted: row.promoted || false,
      heroSlug: row.heroSlug || undefined,
      heroClass: row.heroClass || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Generate unique slug from title
   */
  private async generateSlug(baseName: string, excludeId?: string): Promise<string> {
    let baseSlug = baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 100)
      .replace(/^-+|-+$/g, '');

    if (!baseSlug) {
      baseSlug = 'article';
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const conditions = excludeId
        ? and(eq(articles.slug, slug), sql`${articles.id} != ${excludeId}`)
        : eq(articles.slug, slug);

      const existing = await db
        .select({ id: articles.id })
        .from(articles)
        .where(conditions)
        .limit(1);

      if (existing.length === 0) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // ====================================
  // CRUD Operations
  // ====================================

  async createArticle(
    authorId: string,
    data: CreateArticleDTO
  ): AsyncResult<ArticleDTO> {
    try {
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

      // Generate unique publicId
      const publicId = nanoid(10);
      const articleId = nanoid(21);

      // Generate slug if not provided
      const slug = data.slug || await this.generateSlug(data.title);

      // Get author name
      const author = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, authorId))
        .limit(1);

      const newArticle = await db
        .insert(articles)
        .values({
          id: articleId,
          publicId,
          title: data.title.trim(),
          subtitle: data.subtitle?.trim(),
          slug,
          contentType: data.contentType,
          image: data.image,
          sections: data.sections || [],
          status: data.status || 'draft',
          authorId,
          content: '', // Legacy field
          heroSlug: data.heroSlug?.toLowerCase().trim(),
          heroClass: data.heroClass?.toLowerCase().trim(),
          isUserArticle: false, // Admin articles
          categories: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: this.toDTO({
          ...newArticle[0],
          authorName: author[0]?.username,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.createArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create article',
      };
    }
  }

  async getArticle(idOrSlugOrPublicId: string): AsyncResult<ArticleDTO | null> {
    try {
      // Try publicId first (most common)
      let article = await db
        .select({
          article: articles,
          authorName: users.username,
        })
        .from(articles)
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(eq(articles.publicId, idOrSlugOrPublicId))
        .limit(1);

      // Try slug
      if (article.length === 0) {
        article = await db
          .select({
            article: articles,
            authorName: users.username,
          })
          .from(articles)
          .leftJoin(users, eq(articles.authorId, users.id))
          .where(eq(articles.slug, idOrSlugOrPublicId))
          .limit(1);
      }

      // Try ID
      if (article.length === 0) {
        article = await db
          .select({
            article: articles,
            authorName: users.username,
          })
          .from(articles)
          .leftJoin(users, eq(articles.authorId, users.id))
          .where(eq(articles.id, idOrSlugOrPublicId))
          .limit(1);
      }

      if (article.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.toDTO({
          ...article[0].article,
          authorName: article[0].authorName,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article',
      };
    }
  }

  async getArticleById(id: string): AsyncResult<ArticleDTO | null> {
    try {
      const article = await db
        .select({
          article: articles,
          authorName: users.username,
        })
        .from(articles)
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(eq(articles.id, id))
        .limit(1);

      if (article.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.toDTO({
          ...article[0].article,
          authorName: article[0].authorName,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getArticleById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by ID',
      };
    }
  }

  async getArticleBySlug(slug: string): AsyncResult<ArticleDTO | null> {
    try {
      const article = await db
        .select({
          article: articles,
          authorName: users.username,
        })
        .from(articles)
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(eq(articles.slug, slug))
        .limit(1);

      if (article.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.toDTO({
          ...article[0].article,
          authorName: article[0].authorName,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getArticleBySlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by slug',
      };
    }
  }

  async getArticleByPublicId(publicId: string): AsyncResult<ArticleDTO | null> {
    try {
      const article = await db
        .select({
          article: articles,
          authorName: users.username,
        })
        .from(articles)
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(eq(articles.publicId, publicId))
        .limit(1);

      if (article.length === 0) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.toDTO({
          ...article[0].article,
          authorName: article[0].authorName,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getArticleByPublicId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article by publicId',
      };
    }
  }

  async updateArticle(
    idOrPublicId: string,
    userId: string,
    updates: UpdateArticleDTO,
    options?: { skipOwnershipCheck?: boolean }
  ): AsyncResult<ArticleDTO> {
    try {
      // Find article
      const existing = await db
        .select()
        .from(articles)
        .where(
          or(
            eq(articles.id, idOrPublicId),
            eq(articles.publicId, idOrPublicId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return { success: false, error: 'Article not found' };
      }

      // Check ownership unless superadmin
      if (!options?.skipOwnershipCheck && existing[0].authorId !== userId) {
        return { success: false, error: 'Access denied' };
      }

      // Generate new slug if title changed
      let newSlug = updates.slug;
      if (!newSlug && updates.title) {
        newSlug = await this.generateSlug(updates.title, existing[0].id);
      }

      const updateFields: any = { updatedAt: new Date() };
      if (updates.title !== undefined) updateFields.title = updates.title.trim();
      if (updates.subtitle !== undefined) updateFields.subtitle = updates.subtitle?.trim();
      if (newSlug) updateFields.slug = newSlug;
      if (updates.contentType !== undefined) updateFields.contentType = updates.contentType;
      if (updates.categories !== undefined) updateFields.categories = updates.categories;
      if (updates.image !== undefined) updateFields.image = updates.image;
      if (updates.status !== undefined) updateFields.status = updates.status;
      if (updates.sections !== undefined) updateFields.sections = updates.sections;
      if (updates.heroSlug !== undefined) updateFields.heroSlug = updates.heroSlug?.toLowerCase().trim();
      if (updates.heroClass !== undefined) updateFields.heroClass = updates.heroClass?.toLowerCase().trim();
      if (updates.promoted !== undefined) updateFields.promoted = updates.promoted;

      const updated = await db
        .update(articles)
        .set(updateFields)
        .where(eq(articles.id, existing[0].id))
        .returning();

      // Get author name
      const author = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, updated[0].authorId))
        .limit(1);

      return {
        success: true,
        data: this.toDTO({
          ...updated[0],
          authorName: author[0]?.username,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.updateArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update article',
      };
    }
  }

  async deleteArticle(id: string, userId: string): AsyncResult<boolean> {
    try {
      const result = await db
        .delete(articles)
        .where(and(eq(articles.id, id), eq(articles.authorId, userId)))
        .returning({ id: articles.id });

      if (result.length === 0) {
        return { success: false, error: 'Article not found or access denied' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresArticleService.deleteArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete article',
      };
    }
  }

  async listArticles(
    filters: ArticleListFilters,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number; hasMore: boolean }> {
    try {
      let conditions = [];

      if (filters.status) conditions.push(eq(articles.status, filters.status));
      if (filters.contentType) conditions.push(eq(articles.contentType, filters.contentType));
      if (filters.authorId) conditions.push(eq(articles.authorId, filters.authorId));
      if (filters.heroSlug) conditions.push(eq(articles.heroSlug, filters.heroSlug));
      if (filters.isUserArticle !== undefined) conditions.push(eq(articles.isUserArticle, filters.isUserArticle));
      if (filters.search) {
        conditions.push(
          or(
            sql`${articles.title} ILIKE ${`%${filters.search}%`}`,
            sql`${articles.subtitle} ILIKE ${`%${filters.search}%`}`
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(articles)
        .where(whereClause);

      // Get articles
      let query = db
        .select({
          article: articles,
          authorName: users.username,
        })
        .from(articles)
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(whereClause);

      // Apply sorting
      if (options?.sortBy === 'title') {
        query = query.orderBy(options.sortOrder === 'asc' ? asc(articles.title) : desc(articles.title));
      } else {
        query = query.orderBy(desc(articles.createdAt));
      }

      if (options?.skip) query = query.offset(options.skip);
      if (options?.limit) query = query.limit(options.limit);

      const rows = await query;

      const articleDTOs = rows.map((row) =>
        this.toDTO({
          ...row.article,
          authorName: row.authorName,
        })
      );

      return {
        success: true,
        data: {
          articles: articleDTOs,
          total: count,
          hasMore: options?.limit ? options.skip + options.limit < count : false,
        },
      };
    } catch (error) {
      console.error('[PostgresArticleService.listArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list articles',
      };
    }
  }

  // ====================================
  // Section Management (Stubs - Can be enhanced later)
  // ====================================

  async appendSection(
    idOrPublicId: string,
    userId: string,
    section: ArticleSectionDTO
  ): AsyncResult<ArticleDTO> {
    // Simplified stub
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  async appendSections(
    idOrPublicId: string,
    userId: string,
    sections: ArticleSectionDTO[]
  ): AsyncResult<ArticleDTO> {
    // Simplified stub
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  async insertSection(
    idOrPublicId: string,
    userId: string,
    position: number,
    section: ArticleSectionDTO
  ): AsyncResult<ArticleDTO> {
    // Simplified stub
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  async updateSection(
    idOrPublicId: string,
    userId: string,
    sectionIndex: number,
    section: ArticleSectionDTO
  ): AsyncResult<ArticleDTO> {
    // Simplified stub
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  async deleteSection(
    idOrPublicId: string,
    userId: string,
    sectionIndex: number
  ): AsyncResult<ArticleDTO> {
    // Simplified stub
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  // ====================================
  // Publishing & Status
  // ====================================

  async updateStatus(
    idOrPublicId: string,
    userId: string,
    status: ArticleStatus
  ): AsyncResult<ArticleDTO> {
    try {
      return await this.updateArticle(idOrPublicId, userId, { status });
    } catch (error) {
      console.error('[PostgresArticleService.updateStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  async getPublishedArticles(
    filters?: Partial<ArticleListFilters>,
    options?: ArticleListOptions
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }> {
    try {
      return await this.listArticles(
        { ...filters, status: 'published' },
        options
      ) as any;
    } catch (error) {
      console.error('[PostgresArticleService.getPublishedArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published articles',
      };
    }
  }

  async getPublishedArticleSlugs(contentType?: ArticleContentType): AsyncResult<string[]> {
    try {
      const conditions = contentType
        ? and(eq(articles.status, 'published'), eq(articles.contentType, contentType))
        : eq(articles.status, 'published');

      const slugs = await db
        .select({ slug: articles.slug })
        .from(articles)
        .where(conditions);

      return {
        success: true,
        data: slugs.map((s) => s.slug).filter(Boolean),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getPublishedArticleSlugs] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published slugs',
      };
    }
  }

  async getPublishedArticlePublicIds(contentType?: ArticleContentType): AsyncResult<string[]> {
    try {
      const conditions = contentType
        ? and(eq(articles.status, 'published'), eq(articles.contentType, contentType))
        : eq(articles.status, 'published');

      const publicIds = await db
        .select({ publicId: articles.publicId })
        .from(articles)
        .where(conditions);

      return {
        success: true,
        data: publicIds.map((p) => p.publicId),
      };
    } catch (error) {
      console.error('[PostgresArticleService.getPublishedArticlePublicIds] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get published publicIds',
      };
    }
  }

  // ====================================
  // Import/Export (Stubs)
  // ====================================

  async exportArticle(idOrPublicId: string): AsyncResult<ArticleExportDTO> {
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  async importArticle(
    authorId: string,
    data: ArticleExportDTO
  ): AsyncResult<ArticleDTO> {
    return {
      success: false,
      error: 'Method not fully implemented yet',
    };
  }

  // ====================================
  // Utilities
  // ====================================

  async slugExists(slug: string, excludeId?: string): AsyncResult<boolean> {
    try {
      const conditions = excludeId
        ? and(eq(articles.slug, slug), sql`${articles.id} != ${excludeId}`)
        : eq(articles.slug, slug);

      const result = await db
        .select({ id: articles.id })
        .from(articles)
        .where(conditions)
        .limit(1);

      return { success: true, data: result.length > 0 };
    } catch (error) {
      console.error('[PostgresArticleService.slugExists] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check slug existence',
      };
    }
  }

  async validateSection(section: ArticleSectionDTO): AsyncResult<SectionValidationResult> {
    // Simplified validation - can be enhanced
    return {
      success: true,
      data: {
        valid: true,
        errors: [],
        warnings: [],
      },
    };
  }

  async validateSections(sections: ArticleSectionDTO[]): AsyncResult<SectionValidationResult[]> {
    try {
      const results = await Promise.all(
        sections.map((section, index) =>
          this.validateSection(section).then((result) => ({
            ...result.data,
            sectionIndex: index,
          }))
        )
      );

      return { success: true, data: results };
    } catch (error) {
      console.error('[PostgresArticleService.validateSections] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate sections',
      };
    }
  }

  // ====================================
  // User Articles (Stubs - Can be enhanced later)
  // ====================================

  async checkUserArticleRateLimit(userId: string): AsyncResult<{ allowed: boolean; remaining: number }> {
    // Simplified stub
    return {
      success: true,
      data: {
        allowed: true,
        remaining: this.USER_DAILY_ARTICLE_LIMIT,
      },
    };
  }

  async createUserArticle(
    userId: string,
    data: CreateUserArticleDTO
  ): AsyncResult<ArticleDTO> {
    try {
      const publicId = nanoid(10);
      const articleId = nanoid(21);
      const slug = await this.generateSlug(data.title);

      const author = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const newArticle = await db
        .insert(articles)
        .values({
          id: articleId,
          publicId,
          title: data.title.trim(),
          subtitle: data.subtitle?.trim(),
          slug,
          contentType: data.contentType,
          image: data.image,
          sections: data.sections || [],
          status: 'draft',
          authorId: userId,
          content: '',
          heroSlug: data.heroSlug?.toLowerCase().trim(),
          heroClass: data.heroClass?.toLowerCase().trim(),
          isUserArticle: true,
          categories: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        data: this.toDTO({
          ...newArticle[0],
          authorName: author[0]?.username,
        }),
      };
    } catch (error) {
      console.error('[PostgresArticleService.createUserArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user article',
      };
    }
  }

  async getUserArticles(
    userId: string,
    filters?: UserArticleListFilters
  ): AsyncResult<{ articles: ArticleDTO[]; total: number }> {
    try {
      return await this.listArticles({
        authorId: userId,
        isUserArticle: true,
        ...filters,
      }) as any;
    } catch (error) {
      console.error('[PostgresArticleService.getUserArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user articles',
      };
    }
  }

  async updateUserArticle(
    publicId: string,
    userId: string,
    updates: UpdateUserArticleDTO
  ): AsyncResult<ArticleDTO> {
    return await this.updateArticle(publicId, userId, updates);
  }

  async deleteUserArticle(publicId: string, userId: string): AsyncResult<boolean> {
    try {
      const result = await db
        .delete(articles)
        .where(
          and(
            eq(articles.publicId, publicId),
            eq(articles.authorId, userId),
            eq(articles.isUserArticle, true)
          )
        )
        .returning({ id: articles.id });

      if (result.length === 0) {
        return { success: false, error: 'Article not found or access denied' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresArticleService.deleteUserArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user article',
      };
    }
  }

  async countArticles(filters: ArticleListFilters): AsyncResult<number> {
    try {
      let conditions = [];

      if (filters.status) conditions.push(eq(articles.status, filters.status));
      if (filters.contentType) conditions.push(eq(articles.contentType, filters.contentType));
      if (filters.authorId) conditions.push(eq(articles.authorId, filters.authorId));
      if (filters.isUserArticle !== undefined) conditions.push(eq(articles.isUserArticle, filters.isUserArticle));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(articles)
        .where(whereClause);

      return { success: true, data: count };
    } catch (error) {
      console.error('[PostgresArticleService.countArticles] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count articles',
      };
    }
  }

  async promoteArticle(
    articleId: string,
    adminId: string,
    promoted: boolean
  ): AsyncResult<ArticleDTO> {
    try {
      return await this.updateArticle(
        articleId,
        adminId,
        { promoted },
        { skipOwnershipCheck: true }
      );
    } catch (error) {
      console.error('[PostgresArticleService.promoteArticle] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update promotion status',
      };
    }
  }
}

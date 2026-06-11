/**
 * Articles Client Service
 *
 * Client-side API abstraction for user article operations.
 * Handles article CRUD, section management, and publishing.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// Import types from server-side contract
import type {
  ArticleDTO,
  ArticleStatus,
} from '@/lib/services/contracts/IArticleService';

// ====================================
// Article CRUD Operations
// ====================================

/**
 * Get user's articles list with filtering and pagination
 *
 * @param filters - Optional filters (status, contentType)
 * @param pagination - Optional pagination (page, limit)
 * @returns Paginated list of articles
 *
 * @example
 * ```typescript
 * const result = await getUserArticles(
 *   { status: 'published', contentType: 'article' },
 *   { page: 1, limit: 20 }
 * );
 * if (result.success) {
 *   console.log(result.data.articles);
 * }
 * ```
 */
export async function getUserArticles(
  filters?: {
    status?: ArticleStatus;
    contentType?: 'article' | 'strategy' | 'hero' | 'guide' | 'tournament';
  },
  pagination?: { page?: number; limit?: number }
): Promise<ApiResponse<{ articles: ArticleDTO[]; total: number }>> {
  try {
    const params = buildQueryParams({
      page: pagination?.page || 1,
      limit: pagination?.limit || 20,
      ...filters,
    });

    const response = await fetch(`/api/user-articles?${params.toString()}`);
    return await handleResponse<{ articles: ArticleDTO[]; total: number }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get a single article by public ID
 *
 * @param publicId - The article's public ID (10-char nanoid)
 * @returns Full article data
 *
 * @example
 * ```typescript
 * const result = await getArticle('abc1234567');
 * if (result.success) {
 *   console.log(result.data.title, result.data.sections);
 * }
 * ```
 */
export async function getArticle(publicId: string): Promise<ApiResponse<ArticleDTO>> {
  try {
    const response = await fetch(`/api/user-articles/${publicId}`);
    return await handleResponse<ArticleDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Create a new article
 *
 * @param data - Article creation data
 * @returns Created article
 *
 * @example
 * ```typescript
 * const result = await createArticle({
 *   title: 'My First Article',
 *   slug: 'my-first-article',
 *   contentType: 'article',
 *   sections: []
 * });
 * if (result.success) {
 *   console.log('Article created:', result.data.publicId);
 * }
 * ```
 */
export async function createArticle(data: {
  title: string;
  subtitle?: string;
  slug?: string;
  contentType?: 'article' | 'strategy' | 'hero' | 'guide' | 'tournament'; // defaults to 'strategy' server-side

  image?: string;
  sections?: any[];
  status?: ArticleStatus;
  heroClass?: string;
  heroSlug?: string;
}): Promise<ApiResponse<ArticleDTO>> {
  try {
    const response = await fetch('/api/user-articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<ArticleDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update article metadata and content
 *
 * @param publicId - The article's public ID
 * @param updates - Fields to update
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await updateArticle('abc1234567', {
 *   title: 'Updated Title',
 *   status: 'published',
 *   sections: updatedSections
 * });
 * if (result.success) {
 *   console.log('Article updated');
 * }
 * ```
 */
export async function updateArticle(
  publicId: string,
  updates: {
    title?: string;
    subtitle?: string;
    status?: ArticleStatus;
    contentType?: 'article' | 'strategy' | 'hero' | 'guide' | 'tournament';
    image?: string;
    sections?: any[];
    heroClass?: string;
    heroSlug?: string;
  }
): Promise<ApiResponse<ArticleDTO>> {
  try {
    const response = await fetch(`/api/user-articles/${publicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<ArticleDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete an article
 *
 * @param publicId - The article's public ID
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await deleteArticle('abc1234567');
 * if (result.success) {
 *   console.log('Article deleted');
 * }
 * ```
 */
export async function deleteArticle(
  publicId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const response = await fetch(`/api/user-articles/${publicId}`, {
      method: 'DELETE',
    });
    return await handleResponse<{ deleted: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Section Management Operations
// ====================================

/**
 * Add a section to an article
 *
 * @param publicId - The article's public ID
 * @param section - Section to add
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await addSection('abc1234567', {
 *   type: 'text',
 *   content: '# Hello World\n\nThis is markdown content.'
 * });
 * ```
 */
export async function addSection(
  publicId: string,
  section: any
): Promise<ApiResponse<ArticleDTO>> {
  try {
    // Get current article
    const getResult = await getArticle(publicId);
    if (!getResult.success) return getResult;

    // Append section
    const sections = [...(getResult.data.sections || []), section];

    // Update article
    return await updateArticle(publicId, { sections });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update a section at a specific index
 *
 * @param publicId - The article's public ID
 * @param index - Section index
 * @param section - Updated section data
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await updateSection('abc1234567', 0, {
 *   type: 'text',
 *   content: 'Updated content'
 * });
 * ```
 */
export async function updateSection(
  publicId: string,
  index: number,
  section: any
): Promise<ApiResponse<ArticleDTO>> {
  try {
    // Get current article
    const getResult = await getArticle(publicId);
    if (!getResult.success) return getResult;

    // Update section at index
    const sections = [...(getResult.data.sections || [])];
    if (index < 0 || index >= sections.length) {
      return { success: false, error: 'Invalid section index' };
    }

    sections[index] = section;

    // Update article
    return await updateArticle(publicId, { sections });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete a section at a specific index
 *
 * @param publicId - The article's public ID
 * @param index - Section index to delete
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await deleteSection('abc1234567', 2);
 * if (result.success) {
 *   console.log('Section deleted');
 * }
 * ```
 */
export async function deleteSection(
  publicId: string,
  index: number
): Promise<ApiResponse<ArticleDTO>> {
  try {
    // Get current article
    const getResult = await getArticle(publicId);
    if (!getResult.success) return getResult;

    // Remove section at index
    const sections = [...(getResult.data.sections || [])];
    if (index < 0 || index >= sections.length) {
      return { success: false, error: 'Invalid section index' };
    }

    sections.splice(index, 1);

    // Update article
    return await updateArticle(publicId, { sections });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Reorder sections in an article
 *
 * @param publicId - The article's public ID
 * @param sections - New section order
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const reorderedSections = [sections[2], sections[0], sections[1]];
 * const result = await reorderSections('abc1234567', reorderedSections);
 * ```
 */
export async function reorderSections(
  publicId: string,
  sections: any[]
): Promise<ApiResponse<ArticleDTO>> {
  try {
    return await updateArticle(publicId, { sections });
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Publishing Operations
// ====================================

/**
 * Publish an article (set status to 'published')
 *
 * @param publicId - The article's public ID
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await publishArticle('abc1234567');
 * if (result.success) {
 *   console.log('Article is now live!');
 * }
 * ```
 */
export async function publishArticle(publicId: string): Promise<ApiResponse<ArticleDTO>> {
  try {
    return await updateArticle(publicId, { status: 'published' });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Unpublish an article (set status to 'draft')
 *
 * @param publicId - The article's public ID
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await unpublishArticle('abc1234567');
 * if (result.success) {
 *   console.log('Article is now a draft');
 * }
 * ```
 */
export async function unpublishArticle(publicId: string): Promise<ApiResponse<ArticleDTO>> {
  try {
    return await updateArticle(publicId, { status: 'draft' });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Toggle article status between draft and published
 *
 * @param publicId - The article's public ID
 * @param currentStatus - Current article status
 * @returns Updated article
 *
 * @example
 * ```typescript
 * const result = await toggleArticleStatus('abc1234567', 'draft');
 * // Article is now 'published'
 * ```
 */
export async function toggleArticleStatus(
  publicId: string,
  currentStatus: ArticleStatus
): Promise<ApiResponse<ArticleDTO>> {
  try {
    const newStatus: ArticleStatus = currentStatus === 'draft' ? 'published' : 'draft';
    return await updateArticle(publicId, { status: newStatus });
  } catch (error) {
    return handleError(error);
  }
}

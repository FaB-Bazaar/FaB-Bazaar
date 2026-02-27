import { unstable_cache } from 'next/cache';
import { articleService } from '@/lib/services';
import type { ArticleDTO } from './services/contracts/IArticleService';
import type { AsyncResult } from './services/contracts/common';

/**
 * Cached wrapper for articleService.getArticleByPublicId
 *
 * Cache tags:
 * - article-{publicId} - Specific article
 * - articles-published - All published articles
 */
export const getCachedArticleByPublicId = (publicId: string) => unstable_cache(
  async (): Promise<AsyncResult<ArticleDTO | null>> => {
    return await articleService.getArticleByPublicId(publicId);
  },
  // Cache key (must be pure function)
  [`article-by-publicId-${publicId}`],
  {
    // Tags for invalidation
    tags: [`article-${publicId}`, 'articles-published'],
    // Fallback TTL (1 hour)
    revalidate: 3600,
  }
)();

/**
 * Cached wrapper for generateStaticParams
 * Returns only publicIds to avoid over-fetching
 */
export const getCachedArticlePublicIds = unstable_cache(
  async () => {
    const result = await articleService.listArticles(
      { status: 'published' },
      { sort: { createdAt: -1 } }
    );

    if (!result.success) {
      return [];
    }

    // Filter out hero articles (they use /heroes route)
    return result.data.articles
      .filter(article => article.contentType !== 'hero')
      .map(article => article.publicId);
  },
  ['article-publicIds-for-static-params'],
  {
    tags: ['articles-published'],
    revalidate: 3600,
  }
);

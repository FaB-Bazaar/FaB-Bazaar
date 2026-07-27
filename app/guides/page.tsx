import { articleService, userService } from '@/lib/services';
import { resolveArticleImageUrl, resolveArticleImageUrls } from '@/lib/images/article-image';
import { GuidesContent } from './GuidesContent';

export const dynamic = 'force-dynamic';

// Calculate estimated read time from article sections
function calculateReadTime(sections: any[]): number {
  if (!sections?.length) return 1;
  let words = 0;
  let extraMinutes = 0;

  for (const section of sections) {
    switch (section.type) {
      case 'text':
        words += (section.content || '').split(/\s+/).filter(Boolean).length;
        break;
      case 'video':
        extraMinutes += 3;
        break;
      case 'decklist-block':
        extraMinutes += 2;
        break;
      case 'match-report':
        extraMinutes += 2;
        break;
      case 'card-carousel':
        extraMinutes += 1;
        break;
      default:
        extraMinutes += 0.5;
    }
  }

  const readingMinutes = Math.ceil(words / 200);
  return Math.max(1, Math.round(readingMinutes + extraMinutes));
}

export interface EnrichedArticle {
  _id: string;
  title: string;
  subtitle?: string;
  publicId: string;
  slug: string;
  contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament';
  categories?: string[];
  image?: string;
  /** Renderable cover url. Null when there's nothing to show — see lib/images/article-image. */
  imageUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
  heroSlug?: string;
  heroClass?: string;
  isUserArticle: boolean;
  promoted: boolean;
  author: {
    username?: string;
    discordUsername?: string;
  };
  readTime: number;
}

async function getPublishedArticles(): Promise<EnrichedArticle[]> {
  try {
    const result = await articleService.listArticles(
      { status: 'published' },
      { sort: { createdAt: -1 } }
    );

    if (!result.success) {
      console.error('Error fetching articles:', result.error);
      return [];
    }

    // Collect unique author IDs
    const authorIds = [...new Set(
      result.data.articles
        .map(a => a.authorId)
        .filter(Boolean)
    )] as string[];

    // Batch fetch author info
    const authorMap = new Map<string, { username?: string; discordUsername?: string }>();
    for (const authorId of authorIds) {
      const authorResult = await userService.getBasicInfo(authorId);
      if (authorResult.success && authorResult.data) {
        authorMap.set(authorId, authorResult.data);
      }
    }

    // Covers picked from a card store a printing_id — resolve those to the
    // printing's stored image_url (the id-keyed CDN images are gone).
    const printingImageUrls = await resolveArticleImageUrls(
      result.data.articles.map(a => a.image)
    );

    // Enrich articles with author info and read time
    return result.data.articles.map(article => ({
      _id: article._id || '',
      title: article.title,
      subtitle: article.subtitle,
      publicId: article.publicId,
      slug: article.slug,
      contentType: article.contentType,
      categories: article.categories || [],
      image: article.image,
      imageUrl: resolveArticleImageUrl(article.image, printingImageUrls),
      heroSlug: article.heroSlug,
      heroClass: article.heroClass,
      isUserArticle: article.isUserArticle || false,
      promoted: article.promoted || false,
      createdAt: article.createdAt?.toISOString(),
      updatedAt: article.updatedAt?.toISOString(),
      author: authorMap.get(article.authorId || '') || { username: 'Anonymous' },
      readTime: calculateReadTime(article.sections || []),
    }));
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

export default async function AllGuidesPage() {
  const allArticles = await getPublishedArticles();

  return <GuidesContent articles={allArticles} />;
}

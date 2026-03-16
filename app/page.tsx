import { articleService } from '@/lib/services';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  const result = await articleService.listArticles(
    { status: 'published', isUserArticle: false },
    { limit: 3, skip: 0 }
  );

  const articles = result.success
    ? result.data.articles.map((a) => ({
        publicId: a.publicId,
        title: a.title,
        subtitle: a.subtitle,
        image: a.image,
        contentType: a.contentType,
      }))
    : [];

  return <HomePageClient articles={articles} />;
}

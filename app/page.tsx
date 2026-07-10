export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { articleService } from '@/lib/services';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  // Signed in → /volzar, the logged-in home (Volzar is standard for every
  // account). The marketing home below is signed-out-only. Read straight off
  // the session token; the chat page re-gates server-side.
  const session = await auth();
  if (session?.user?.id) {
    redirect('/volzar');
  }

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

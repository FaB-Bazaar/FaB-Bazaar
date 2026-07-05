export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { articleService } from '@/lib/services';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  // Fabby Chat supporters (paid Metafy tier or a manual grant) land on the chat
  // — it's their home. Superadmins keep the normal marketing home (they have the
  // whole admin surface to reach). Read straight off the session token; the chat
  // page re-gates server-side.
  const session = await auth();
  const roles = session?.user?.roles;
  const isSupporter = roles?.metafySupporterTier === 'paid' || !!roles?.fabbyChatAccess;
  if (isSupporter && !roles?.isSuperAdmin) {
    redirect('/fabby-chat');
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

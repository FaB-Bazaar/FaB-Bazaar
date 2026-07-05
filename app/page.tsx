export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { articleService } from '@/lib/services';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  // Paid Metafy supporters land on Fabby Chat — it's their home. Superadmins
  // keep the normal marketing home (they have the whole admin surface to reach).
  // Read straight off the session token; the chat page re-gates server-side.
  const session = await auth();
  const roles = session?.user?.roles;
  if (roles?.metafySupporterTier === 'paid' && !roles.isSuperAdmin) {
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

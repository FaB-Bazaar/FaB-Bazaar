export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { articleService, userService } from '@/lib/services';
import { resolveLandingPath } from '@/lib/landing-page';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  // Signed in → the user's landing page preference (users.landing_page),
  // default /volzar. The marketing home below is signed-out-only.
  // Failure-safe: a broken preference read degrades to /volzar; redirect()
  // throws, so it stays outside the try.
  const session = await auth();
  if (session?.user?.id) {
    let landingPage: string | undefined;
    try {
      const info = await userService.getBasicInfo(session.user.id);
      landingPage = info.success ? info.data?.landingPage : undefined;
    } catch {
      landingPage = undefined;
    }
    redirect(resolveLandingPath(landingPage));
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

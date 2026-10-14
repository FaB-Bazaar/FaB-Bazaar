export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { articleService, setsService, userService } from '@/lib/services';
import { resolveLandingPath } from '@/lib/landing-page';
import { resolveArticleImageUrl, resolveArticleImageUrls } from '@/lib/images/article-image';
import { pickSpoilerSet } from '@/lib/home/spoiler-set';
import { setLogoUrl } from '@/lib/set-images';
import HomePageClient from '@/components/home/HomePageClient';

export default async function HomePage() {
  // Signed in → the user's landing page preference (users.landing_page),
  // default /daily (daily movers). The marketing home below is signed-out-only.
  // Failure-safe: a broken preference read degrades to the default; redirect()
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

  const [result, setsResult] = await Promise.all([
    articleService.listArticles(
      { status: 'published', isUserArticle: false },
      { limit: 3, skip: 0 }
    ),
    setsService.listSets(),
  ]);

  // Spoiler-season banner: the next main set still ahead of its release date.
  const spoiler = setsResult.success
    ? pickSpoilerSet(setsResult.data, new Date().toISOString().slice(0, 10))
    : null;
  const spoilerSet = spoiler && {
    code: spoiler.code,
    name: spoiler.name,
    logoUrl: spoiler.imageId ? setLogoUrl(spoiler.imageId) : undefined,
    releaseLabel: new Date(`${spoiler.releaseDate}T00:00:00Z`).toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
    }),
  };

  // `image` is a bare id (upload UUID or printing_id) — resolve to a renderable
  // url server-side; printing_id-keyed CDN urls must never be constructed
  // (lib/images/article-image). Undefined → the client shows its placeholder.
  const rawArticles = result.success ? result.data.articles : [];
  const printingImageUrls = await resolveArticleImageUrls(rawArticles.map((a) => a.image));
  const articles = rawArticles.map((a) => ({
    publicId: a.publicId,
    title: a.title,
    subtitle: a.subtitle,
    image: resolveArticleImageUrl(a.image, printingImageUrls) ?? undefined,
    contentType: a.contentType,
  }));

  return <HomePageClient articles={articles} spoilerSet={spoilerSet} />;
}

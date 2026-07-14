import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';
import { userService } from '@/lib/services';
import { resolveLandingPath } from '@/lib/landing-page';

export const dynamic = 'force-dynamic';

// Post-login landing: signed-in users head to their chosen landing page
// (users.landing_page, default /volzar — matches the homepage redirect in
// app/page.tsx). Login is also a good moment to refresh the Metafy supporter
// tier (TTL-throttled) for the other supporter surfaces.
export default async function PostLoginPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/discord');
  }

  await syncSupporterTierIfStale(user.id);

  // Failure-safe: a broken preference read degrades to the /volzar default.
  // redirect() throws, so it must stay outside the try.
  let landingPage: string | undefined;
  try {
    const info = await userService.getBasicInfo(user.id);
    landingPage = info.success ? info.data?.landingPage : undefined;
  } catch {
    landingPage = undefined;
  }

  redirect(resolveLandingPath(landingPage));
}

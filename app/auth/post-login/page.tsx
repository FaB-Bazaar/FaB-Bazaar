import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';

export const dynamic = 'force-dynamic';

// Post-login landing: every signed-in user heads to /volzar, the logged-in
// home (matches the homepage redirect in app/page.tsx). Login is also a good
// moment to refresh the Metafy supporter tier (TTL-throttled) for the other
// supporter surfaces.
export default async function PostLoginPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/discord');
  }

  await syncSupporterTierIfStale(user.id);

  redirect('/volzar');
}

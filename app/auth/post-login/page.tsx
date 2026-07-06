import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { canUseVolzar } from '@/lib/ai/volzar-access';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';

export const dynamic = 'force-dynamic';

// Post-login landing. The OAuth sign-in flow redirects here (not straight to
// /discord) so we can make the destination access-aware server-side:
//   - Volzar users (superadmin / paid Metafy supporter / manual grant) →
//     /volzar, their real home.
//   - everyone else → /discord (the prior default).
//
// The access decision needs a DB read, which is why this lives in a server
// component rather than the edge middleware. We re-verify the Metafy tier
// first (TTL-throttled) so a current paid supporter isn't misrouted on a
// stale flag.
export default async function PostLoginPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/discord');
  }

  await syncSupporterTierIfStale(user.id);

  const access = await userService.getVolzarAccess(user.id);
  if (access.success && canUseVolzar(access.data)) {
    redirect('/volzar');
  }

  redirect('/discord');
}

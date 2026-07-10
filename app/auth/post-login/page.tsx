import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { syncSupporterTierIfStale } from '@/lib/metafy/sync-tier';

export const dynamic = 'force-dynamic';

// Post-login landing. The OAuth sign-in flow redirects here (not straight to
// /discord) so we can make the destination cohort-aware server-side:
//   - superadmins / paid Metafy supporters / manual grants → /volzar, the
//     power-user home.
//   - everyone else → /discord (the prior default).
//
// NOTE: this deliberately does NOT use canUseVolzar — that gate is now "any
// signed-in user" (Volzar is standard), and routing every login to /volzar
// would hijack the landing page for the whole site. The old cohort rule is
// inlined here purely as a routing preference.
//
// The decision needs a DB read, which is why this lives in a server
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
  const prefersVolzar = access.success && !!access.data
    && (access.data.isSuperAdmin || access.data.metafySupporterTier === 'paid' || !!access.data.volzarAccess);
  if (prefersVolzar) {
    redirect('/volzar');
  }

  redirect('/discord');
}

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { FeedOverridesClient } from './FeedOverridesClient';

export default async function AdminFeedOverridesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Feed Overrides</h1>
      <p className="text-muted-foreground mb-8">
        Manual corrections to the fab-cube feed (wrong TCGplayer product ids etc.). Applied by the
        nightly pipeline before price lookup, so corrected ids and prices flow through every run —
        no deploy needed. Takes effect on the next pipeline run.
      </p>
      <FeedOverridesClient />
    </div>
  );
}

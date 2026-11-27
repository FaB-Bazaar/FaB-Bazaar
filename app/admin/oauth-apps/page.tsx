import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { OAuthAppsClient } from './OAuthAppsClient';

// /admin/oauth-apps — which apps may connect to FaB Bazaar through OAuth
// (migration 0136). Superadmin only.
export default async function AdminOAuthAppsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">OAuth apps</h1>
      <p className="text-muted-foreground mb-8 max-w-3xl">
        Only apps on this list can ask a player to connect, refresh their access, or use the partner API. AI
        assistants are allowed by the address they send players back to; a partner app like Cintari is approved
        on its own. Changes apply within a minute. Talishar isn&apos;t here: it uses its own API key.
      </p>
      <OAuthAppsClient />
    </div>
  );
}

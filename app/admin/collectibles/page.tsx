import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { CollectiblesAdminClient } from './CollectiblesAdminClient';

export default async function AdminCollectiblesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Collectibles</h1>
      <p className="text-muted-foreground mb-8">
        Manage the collectible catalog (playmats). Edit descriptions and sources, and upload
        images straight to Cloudflare.
      </p>
      <CollectiblesAdminClient />
    </div>
  );
}

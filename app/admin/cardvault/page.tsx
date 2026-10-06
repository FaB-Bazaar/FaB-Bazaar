import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { CardVaultClient } from './CardVaultClient';

/**
 * /admin/cardvault — superadmin CMS for pulling a set's English printings in
 * from CardVault and uploading their images. In-app twin of
 * scripts/import-new-set.ts (shared planner: lib/import/plan-set-ingest.ts).
 */
export default async function CardVaultAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">CardVault Ingest</h1>
      <p className="text-muted-foreground mb-8">
        Pull a set&apos;s English printings from CardVault and put their images on Cloudflare. Every step
        is safe to repeat: rows that already exist are skipped and nothing is ever deleted. A brand-new
        set? Register it first — it goes live across the site straight away. Translated printings
        (FR/JA/…) are a separate step.
      </p>
      <CardVaultClient />
    </div>
  );
}

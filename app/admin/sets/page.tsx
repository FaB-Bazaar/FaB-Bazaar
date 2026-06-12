// app/admin/sets/page.tsx
// Superadmin: curate the printing display order of sets (sets.display_order).

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { setsService, userService } from '@/lib/services';
import { SetsOrderClient } from './SetsOrderClient';

export default async function SetsAdminPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) {
    redirect('/admin/articles');
  }

  const setsResult = await setsService.listSets();
  if (!setsResult.success) {
    throw new Error('Failed to fetch sets');
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Set Order</h1>
      <p className="text-muted-foreground mb-8">
        Curate the order printings appear in carousels, pickers, and import defaults.
      </p>
      <SetsOrderClient initialSets={setsResult.data} />
    </div>
  );
}

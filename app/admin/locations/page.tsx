import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService, locationService } from '@/lib/services';
import { AdminLocationsClient } from './AdminLocationsClient';

export default async function AdminLocationsPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) {
    redirect('/admin/articles');
  }

  const submissionsResult = await locationService.listSubmissions({ status: 'pending' });
  const initialSubmissions = submissionsResult.success ? submissionsResult.data.submissions : [];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Locations &amp; Events</h1>
      <p className="text-muted-foreground mb-8">
        Review store submissions, or add a venue and event (e.g. a Pro Tour or Calling).
      </p>
      <AdminLocationsClient initialSubmissions={JSON.parse(JSON.stringify(initialSubmissions))} />
    </div>
  );
}

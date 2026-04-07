import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService, locationService } from '@/lib/services';
import { LocationSubmissionsClient } from './LocationSubmissionsClient';

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
      <h1 className="text-3xl font-bold mb-2">Location Submissions</h1>
      <p className="text-muted-foreground mb-8">Review and approve store submissions.</p>
      <LocationSubmissionsClient initialSubmissions={JSON.parse(JSON.stringify(initialSubmissions))} />
    </div>
  );
}

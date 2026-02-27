import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { UserAccessClient } from './UserAccessClient';

export default async function UserAccessAdminPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  // Check if user is a super admin using service layer
  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');

  // Only super admins can access user management
  if (!roleCheck.success || !roleCheck.data) {
    redirect('/admin/articles'); // Redirect content creators to articles
  }

  // Fetch all users using service layer
  const usersResult = await userService.getAllUsers();

  if (!usersResult.success) {
    throw new Error('Failed to fetch users');
  }

  const users = usersResult.data || [];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">User Access Management</h1>
      <p className="text-muted-foreground mb-8">Manage roles and flags for all users.</p>
      <UserAccessClient initialUsers={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
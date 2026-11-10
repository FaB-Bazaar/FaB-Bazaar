import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { parseUserAccessParams, USER_ACCESS_PAGE_SIZE } from '@/lib/admin/user-access-params';
import { UserAccessClient } from './UserAccessClient';

export default async function UserAccessAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
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

  // One page of users (never the whole table) + the counts for the header
  const { page, searchTerm } = parseUserAccessParams(await searchParams);
  const usersResult = await userService.listUsersPage({
    page,
    pageSize: USER_ACCESS_PAGE_SIZE,
    searchTerm,
  });

  if (!usersResult.success) {
    throw new Error('Failed to fetch users');
  }

  const { users, total, totalUsers } = usersResult.data;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">User Access Management</h1>
      <p className="text-muted-foreground mb-8">Manage roles and flags for all users.</p>
      <UserAccessClient
        // Remount on navigation so the list state follows the new page/search
        key={`${page}|${searchTerm}`}
        initialUsers={JSON.parse(JSON.stringify(users))}
        total={total}
        totalUsers={totalUsers}
        page={page}
        pageSize={USER_ACCESS_PAGE_SIZE}
        searchTerm={searchTerm}
      />
    </div>
  );
}
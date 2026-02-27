import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Get the basic, lean session from the cookie.
  const session = await auth();

  // 2. If there's no session, the user isn't logged in. Redirect them.
  if (!session?.user?.id) {
    redirect('/'); // Or to your login page: '/auth/login'
  }

  // 3. Use the service layer to fetch the user profile from the database.
  const userResult = await userService.getProfile(session.user.id);

  if (!userResult.success || !userResult.data) {
    console.log("❌ ADMIN LAYOUT: Failed to fetch user");
    redirect('/');
  }

  const currentUser = userResult.data;

  // --- DEBUGGING LOGS (you can remove these once it works) ---
  console.log("--- ADMIN LAYOUT SECURITY CHECK ---");
  console.log("Session User ID:", session.user.id);
  console.log("User Roles from DB:", JSON.stringify(currentUser?.roles, null, 2));
  // ---

  // 4. Perform the authorization check using the fresh roles from the database.
  // For now, allow anyone with super admin OR content creator role to pass through
  // The nested articles/layout.tsx will do more specific checking
  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isContentCreator = currentUser?.roles?.isContentCreator;
  const hasAnyAdminRole = isSuperAdmin || isContentCreator;

  // 5. If they don't have any admin role, redirect.
  if (!hasAnyAdminRole) {
    console.log("❌ ADMIN LAYOUT: Access denied - No admin privileges");
    redirect('/');
  }

  console.log("✅ ADMIN LAYOUT: Basic access granted (role-specific checks in sub-routes)");

  // 6. If the check passes, render the admin page.
  return <div>{children}</div>;
}
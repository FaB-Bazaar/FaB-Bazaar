import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';

export default async function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Check if user is logged in
  if (!session?.user?.id) {
    redirect('/');
  }

  // Fetch fresh user data from database using service layer
  const userResult = await userService.getProfile(session.user.id);

  if (!userResult.success || !userResult.data) {
    console.log("❌ ARTICLES LAYOUT: Failed to fetch user");
    redirect('/');
  }

  const currentUser = userResult.data;

  console.log("--- ARTICLES LAYOUT SECURITY CHECK ---");
  console.log("Session User ID:", session.user.id);
  console.log("User Roles from DB:", JSON.stringify(currentUser?.roles, null, 2));

  // Allow super admins OR content creators to access articles
  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isContentCreator = currentUser?.roles?.isContentCreator;
  const isAuthorized = isSuperAdmin || isContentCreator;

  if (!isAuthorized) {
    console.log("❌ ARTICLES LAYOUT: Access denied - Super Admin or Content Creator required");
    redirect('/');
  }

  console.log("✅ ARTICLES LAYOUT: Access granted");

  return <>{children}</>;
}
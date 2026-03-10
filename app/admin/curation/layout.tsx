import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';

export default async function CurationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/');
  }

  const userResult = await userService.getProfile(session.user.id);

  if (!userResult.success || !userResult.data) {
    redirect('/');
  }

  const currentUser = userResult.data;

  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isCurator = currentUser?.isCurator;
  const isAuthorized = isSuperAdmin || isCurator;

  if (!isAuthorized) {
    redirect('/');
  }

  return <>{children}</>;
}

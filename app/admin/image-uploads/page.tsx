import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { ImageUploadsClient } from './ImageUploadsClient';

export default async function AdminImageUploadsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Card Image Uploads</h1>
      <p className="text-muted-foreground mb-8">
        Find printings with missing images and upload them directly to Cloudflare under the printing&apos;s deterministic image ID.
      </p>
      <ImageUploadsClient />
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { curatedListService, userService } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit } from 'lucide-react';

export default async function CurationAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const userResult = await userService.getProfile(session.user.id);
  if (!userResult.success || !userResult.data) redirect('/');

  const currentUser = userResult.data;
  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isCurator = currentUser?.isCurator;

  if (!isSuperAdmin && !isCurator) redirect('/');

  const listsResult = await curatedListService.getAllLists();
  const lists = listsResult.success ? listsResult.data : [];

  // Flatten into rows: parents first, then their children indented
  const rows: Array<{ list: (typeof lists)[0]; isChild: boolean }> = [];
  for (const list of lists) {
    rows.push({ list, isChild: false });
    if (list.children && list.children.length > 0) {
      for (const child of list.children) {
        rows.push({ list: child as any, isChild: true });
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Curated Lists</h1>
          <p className="text-muted-foreground">
            Manage curated card lists for deck building suggestions.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/curation/new">
            <Plus className="h-4 w-4 mr-2" />
            New List
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No curated lists yet. Create one to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted-foreground">Name</th>
                <th className="pb-3 font-medium text-muted-foreground">Hero</th>
                <th className="pb-3 font-medium text-muted-foreground">Format</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ list, isChild }) => (
                <tr key={list.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-medium">
                    {isChild ? (
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs pl-4">↳</span>
                        <span className="text-muted-foreground">{list.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">variant</Badge>
                      </span>
                    ) : (
                      list.name
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground">{list.heroName ?? '—'}</td>
                  <td className="py-3 text-muted-foreground">{list.format ?? '—'}</td>
                  <td className="py-3">
                    <Badge variant={list.isPublished ? 'default' : 'secondary'}>
                      {list.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/curation/${list.id}`}>
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

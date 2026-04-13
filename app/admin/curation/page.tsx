import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { curatedListService, userService } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Users } from 'lucide-react';
import type { CuratedListDTO } from '@/lib/services/contracts/ICuratedListService';
import { DeleteListButton } from './DeleteListButton';

function toDisplayName(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ListTable({ lists }: { lists: CuratedListDTO[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 font-medium text-muted-foreground">Name</th>
            <th className="pb-3 font-medium text-muted-foreground">Format</th>
            <th className="pb-3 font-medium text-muted-foreground">Status</th>
            <th className="pb-3 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3 font-medium">{list.name}</td>
              <td className="py-3 text-muted-foreground">{list.format ?? '—'}</td>
              <td className="py-3">
                <Badge variant={list.isPublished ? 'default' : 'secondary'}>
                  {list.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/curation/${list.id}`}>
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Link>
                  </Button>
                  <DeleteListButton listId={list.id} listName={list.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CurationAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const userResult = await userService.getProfile(session.user.id);
  if (!userResult.success || !userResult.data) redirect('/');

  const currentUser = userResult.data;
  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isCurator = currentUser?.isCurator;

  if (!isSuperAdmin && !isCurator) redirect('/');

  const listsResult = isSuperAdmin
    ? await curatedListService.getAllLists()
    : await curatedListService.getListsForCurator(currentUser._id);
  const lists = listsResult.success ? listsResult.data : [];

  const general = lists.filter(l => !l.heroName && !l.className);

  // Group by className
  const classOrder: string[] = [];
  const classMap = new Map<string, CuratedListDTO[]>();
  for (const list of lists.filter(l => l.className)) {
    const key = list.className!;
    if (!classMap.has(key)) {
      classOrder.push(key);
      classMap.set(key, []);
    }
    classMap.get(key)!.push(list);
  }
  classOrder.sort();

  // Group by heroName
  const heroOrder: string[] = [];
  const heroMap = new Map<string, CuratedListDTO[]>();
  for (const list of lists.filter(l => l.heroName)) {
    const key = list.heroName!;
    if (!heroMap.has(key)) {
      heroOrder.push(key);
      heroMap.set(key, []);
    }
    heroMap.get(key)!.push(list);
  }
  heroOrder.sort();

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Curated Lists</h1>
          <p className="text-muted-foreground">
            Manage curated card lists for deck building suggestions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button asChild variant="outline">
              <Link href="/admin/curation/curator-assignments">
                <Users className="h-4 w-4 mr-2" />
                Curators
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/admin/curation/new">
              <Plus className="h-4 w-4 mr-2" />
              New List
            </Link>
          </Button>
        </div>
      </div>

      {lists.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No curated lists yet. Create one to get started.</p>
      ) : (
        <div className="space-y-10">
          {/* General */}
          {general.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">General</h2>
              <ListTable lists={general} />
            </section>
          )}

          {/* By Class */}
          {classOrder.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">By Class</h2>
              <div className="space-y-8">
                {classOrder.map(cls => (
                  <div key={cls}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {toDisplayName(cls)}
                    </h3>
                    <ListTable lists={classMap.get(cls)!} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* By Hero */}
          {heroOrder.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">By Hero</h2>
              <div className="space-y-8">
                {heroOrder.map(hero => (
                  <div key={hero}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {toDisplayName(hero)}
                    </h3>
                    <ListTable lists={heroMap.get(hero)!} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

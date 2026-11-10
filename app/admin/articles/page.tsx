import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Eye, Filter } from 'lucide-react';
import { auth } from '@/auth';
import { DeleteArticleButton } from './DeleteArticleButton';
import { ArticleStatusToggle } from './ArticleStatusToggle';
import { ContentTypeFilter } from './ContentTypeFilter';
import { ImportArticleDialog } from './ImportArticleDialog';
import { articleService, userService } from '@/lib/services';

export default async function AdminArticlesDashboard() {
  console.log("=== ARTICLES PAGE AUTHORIZATION DEBUG ===");

  const session = await auth();
  const user = session?.user;

  console.log("Session exists:", !!session);
  console.log("User ID from session:", user?.id);

  // Check if user can access articles admin
  if (!user?.id) {
    console.log("❌ REDIRECT: No user ID in session");
    redirect('/');
  }

  // Fetch fresh user data from database for accurate role checking using service layer
  console.log("Fetching user from database with ID:", user.id);
  const userResult = await userService.getProfile(user.id);

  if (!userResult.success || !userResult.data) {
    console.log("❌ REDIRECT: User not found in database");
    redirect('/');
  }

  const currentUser = userResult.data;
  console.log("User found in database:", !!currentUser);
  console.log("Current user roles from DB:", JSON.stringify(currentUser?.roles, null, 2));

  // Only allow super admins and content creators
  const isSuperAdmin = currentUser?.roles?.isSuperAdmin;
  const isContentCreator = currentUser?.roles?.isContentCreator;
  const canAccessArticles = isSuperAdmin || isContentCreator;

  console.log("isSuperAdmin:", isSuperAdmin);
  console.log("isContentCreator:", isContentCreator);
  console.log("canAccessArticles:", canAccessArticles);

  if (!canAccessArticles) {
    console.log("❌ REDIRECT: User does not have required roles");
    console.log("Required: isSuperAdmin OR isContentCreator");
    console.log("User has: isSuperAdmin =", isSuperAdmin, ", isContentCreator =", isContentCreator);
    redirect('/');
  }

  console.log("✅ ACCESS GRANTED: User can access articles page");
  console.log("==========================================");

  // Fetch articles using service layer
  const articlesResult = await articleService.listArticles({}, { sort: { updatedAt: -1 } });
  const allArticles = articlesResult.success ? articlesResult.data.articles : [];

  // Serialize the articles for client component
  const serializedArticles = allArticles.map(article => ({
    _id: article._id || '',
    title: article.title,
    subtitle: article.subtitle,
    slug: article.slug,
    contentType: article.contentType,
    status: article.status,
    authorId: article.authorId || '',
    isUserArticle: article.isUserArticle || false,
    promoted: article.promoted || false,
    heroSlug: article.heroSlug || '',
    heroClass: article.heroClass || '',
    createdAt: article.createdAt instanceof Date ? article.createdAt.toISOString() : String(article.createdAt || ''),
    updatedAt: article.updatedAt instanceof Date ? article.updatedAt.toISOString() : String(article.updatedAt || '')
  }));

  const canCreate = currentUser?.roles?.isSuperAdmin || currentUser?.roles?.isContentCreator;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Manage Content</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage all content including hero guides, articles, news, and strategies.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <ImportArticleDialog />
            <Button asChild variant="outline">
              <Link href="/admin/articles/create?contentType=article">
                <Plus className="h-4 w-4 mr-2" />
                Create Article
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/articles/create?contentType=hero">
                <Plus className="h-4 w-4 mr-2" />
                Create Hero Guide
              </Link>
            </Button>
          </div>
        )}
      </div>

      <ContentTypeFilter
        allArticles={serializedArticles}
        currentUserId={user?.id}
        isSuperAdmin={isSuperAdmin}
        isContentCreator={isContentCreator}
      />
    </div>
  );
}

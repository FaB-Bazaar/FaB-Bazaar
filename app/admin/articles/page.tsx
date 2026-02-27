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
// import Link from 'next/link';
// import connectToDatabase from '@/lib/mongodb';
// import Article from '@/models/Article';
// import { Button } from '@/components/ui/button';
// import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { Plus, Edit, Eye } from 'lucide-react';
// import { auth } from '@/auth';
// import { DeleteArticleButton } from './DeleteArticleButton';

// // Import the new client component
// import { ArticleStatusToggle } from './ArticleStatusToggle';

// export default async function AdminArticlesDashboard() {
//   await connectToDatabase();
  
//   const session = await auth();
//   // @ts-ignore
//   const user = session?.user;

//   const allArticles = await Article.find({})
//     .sort({ updatedAt: -1 })
//     .lean();

//   // @ts-ignore
//   const canCreate = user?.roles?.isSuperAdmin || user?.roles?.isContentCreator;
//   // @ts-ignore
//   const isSuperAdmin = user?.roles?.isSuperAdmin;

//   return (
//     <div className="max-w-6xl mx-auto p-4 md:p-8">
//       <div className="flex items-center justify-between mb-8">
//         <div>
//           <h1 className="text-3xl font-bold">Manage Content</h1>
//           <p className="text-muted-foreground">
//             Here you can create, edit, and manage all hero guides and articles.
//           </p>
//         </div>
//         {canCreate && (
//           <Button asChild>
//             <Link href="/admin/articles/create">
//               <Plus className="h-4 w-4 mr-2" />
//               Create New Article
//             </Link>
//           </Button>
//         )}
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         {allArticles.map((article) => {
//           const isOwner = article.authorId.toString() === user?.id?.toString();
//           // @ts-ignore
//           const isContentCreator = user?.roles?.isContentCreator;
          
//           const canEdit = isSuperAdmin || (isContentCreator && isOwner);

//           // Construct the public URL for the "View Live" link
//           const publicUrl = `/${article.contentType === 'hero' ? 'heroes' : 'articles'}/${article.slug}`;

//           return (
//             <Card key={article._id.toString()} className="flex flex-col justify-between">
//               <CardHeader>
//                 <div className="flex items-center justify-between mb-2">
//                   <Badge variant={article.contentType === 'hero' ? 'default' : 'secondary'} className="capitalize">
//                     {article.contentType}
//                   </Badge>
//                   {/* The status badge is now handled by the toggle for admins,
//                       but we can keep it for a quick visual cue if we want.
//                       The toggle itself provides better text feedback. */}
//                 </div>
//                 <CardTitle>{article.title}</CardTitle>
//                 <CardDescription>{article.subtitle}</CardDescription>
//               </CardHeader>
              
//               <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
//   {/* LEFT SIDE: Admin Controls */}
//   <div className="flex flex-col gap-2">
//     {isSuperAdmin ? (
//       <ArticleStatusToggle
//         articleId={article._id.toString()}
//         currentStatus={article.status as 'draft' | 'published'}
//       />
//     ) : (
//       // Show a static badge for non-admins
//       <Badge variant={article.status === 'published' ? 'outline' : 'destructive'}>
//         {article.status === 'published' ? 'Published' : 'Draft'}
//       </Badge>
//     )}
    
//     {canEdit && (
//       <DeleteArticleButton 
//         articleId={article._id.toString()} 
//         articleTitle={article.title}
//       />
//     )}
//   </div>

//   {/* RIGHT SIDE: Action Buttons */}
//   <div className="flex items-center gap-2">
//     {article.status === 'published' && (
//       <Button variant="ghost" size="sm" asChild>
//         <Link href={publicUrl} target="_blank" rel="noopener noreferrer" title="View Live Page">
//           <Eye className="h-4 w-4 mr-2" />
//           View
//         </Link>
//       </Button>
//     )}
//     {canEdit && (
//       <Button variant="outline" size="sm" asChild>
//         <Link href={`/admin/articles/edit/${article._id}`}>
//           <Edit className="h-4 w-4 mr-2" />
//           Edit
//         </Link>
//       </Button>
//     )}
//   </div>
// </CardFooter>
//             </Card>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

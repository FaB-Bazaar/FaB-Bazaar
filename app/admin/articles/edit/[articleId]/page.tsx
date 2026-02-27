import { articleService } from '@/lib/services';
import { ArticleEditForm } from './ArticleEditForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function EditArticlePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;

  // Fetch the specific article by its ID using service layer
  const result = await articleService.getArticleById(articleId);

  if (!result.success || !result.data) {
    notFound();
  }

  const article = result.data;

  // Create a fully serialized plain object to avoid any Mongoose/BSON issues
  const plainArticle = {
    _id: String(article._id),
    title: article.title || '',
    subtitle: article.subtitle || '',
    slug: article.slug || '',
    publicId: article.publicId || '',
    content: article.content || '',
    authorId: String(article.authorId),
    status: article.status || 'draft',
    contentType: article.contentType || 'article',
    categories: article.categories || [],
    image: article.image || '',
    heroSlug: article.heroSlug || '',
    heroClass: article.heroClass || '',
    sections: JSON.parse(JSON.stringify(article.sections || [])),
    createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : null,
    updatedAt: article.updatedAt ? new Date(article.updatedAt).toISOString() : null,
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-2">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin/articles">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Articles</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Edit Content</h1>
      </div>

      <p className="text-muted-foreground mb-8">
        You are editing: <span className="font-semibold text-primary">{article.title}</span>
      </p>

      <ArticleEditForm initialData={plainArticle} />
    </div>
  );
}
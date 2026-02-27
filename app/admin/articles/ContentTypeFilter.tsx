'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Edit, Eye } from 'lucide-react';
import Link from 'next/link';
import { DeleteArticleButton } from './DeleteArticleButton';
import { ArticleStatusToggle } from './ArticleStatusToggle';
import { ArticleContentTypeToggle } from './ArticleContentTypeToggle';
import { ArticlePromoteToggle } from './ArticlePromoteToggle';
import { ExportArticleButton } from './ExportArticleButton';

type Article = {
  _id: string;
  title: string;
  subtitle?: string;
  slug: string;
  contentType: string;
  status: 'draft' | 'published';
  authorId: string;
  isUserArticle: boolean;
  promoted: boolean;
  heroSlug?: string;
  heroClass?: string;
  createdAt: string;
  updatedAt: string;
};

// Format hero name for display (title case)
function formatHeroName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format class name for display
function formatClassName(className: string): string {
  return className.charAt(0).toUpperCase() + className.slice(1);
}

interface ContentTypeFilterProps {
  allArticles: Article[];
  currentUserId?: string;
  isSuperAdmin: boolean;
  isContentCreator: boolean;
}

const CONTENT_TYPE_LABELS = {
  hero: 'Hero Guide',
  article: 'Article',
  guide: 'Guide',
  news: 'News',
  strategy: 'Strategy',
  tournament: 'Tournament Report'
};

const CONTENT_TYPE_COLORS = {
  hero: 'default',
  article: 'secondary',
  guide: 'outline',
  news: 'destructive',
  strategy: 'default',
  tournament: 'outline'
} as const;

export function ContentTypeFilter({ allArticles, currentUserId, isSuperAdmin, isContentCreator }: ContentTypeFilterProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Get counts for each content type
  const typeCounts = allArticles.reduce((acc, article) => {
    acc[article.contentType] = (acc[article.contentType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter articles based on selected type
  const filteredArticles = selectedType
    ? allArticles.filter(article => article.contentType === selectedType)
    : allArticles;

  // Get unique content types from articles
  const availableTypes = Object.keys(typeCounts);

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedType === null ? 'default' : 'outline'}
          onClick={() => setSelectedType(null)}
          size="sm"
        >
          All ({allArticles.length})
        </Button>
        {availableTypes.map(type => (
          <Button
            key={type}
            variant={selectedType === type ? 'default' : 'outline'}
            onClick={() => setSelectedType(type)}
            size="sm"
          >
            {CONTENT_TYPE_LABELS[type as keyof typeof CONTENT_TYPE_LABELS] || type} ({typeCounts[type]})
          </Button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => {
          const publicUrl = `/${article.contentType === 'hero' ? 'heroes' : 'articles'}/${article.publicId}`;
          const isOwner = article.authorId === currentUserId;
          const canEdit = isSuperAdmin || (isContentCreator && isOwner);

          return (
            <Card key={article._id} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <Badge
                    variant={CONTENT_TYPE_COLORS[article.contentType as keyof typeof CONTENT_TYPE_COLORS] || 'secondary'}
                    className="capitalize"
                  >
                    {CONTENT_TYPE_LABELS[article.contentType as keyof typeof CONTENT_TYPE_LABELS] || article.contentType}
                  </Badge>
                  {/* Show hero class/name tags for hero guides */}
                  {article.contentType === 'hero' && article.heroClass && (
                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                      {formatClassName(article.heroClass)}
                    </Badge>
                  )}
                  {article.contentType === 'hero' && article.heroSlug && (
                    <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20">
                      {formatHeroName(article.heroSlug)}
                    </Badge>
                  )}
                  {/* Community badge for user-generated articles */}
                  {article.isUserArticle && (
                    <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                      {article.promoted ? '⭐ Promoted' : 'Community'}
                    </Badge>
                  )}
                  {/* Show warning if hero guide missing classification */}
                  {article.contentType === 'hero' && !article.heroClass && (
                    <Badge variant="destructive" className="text-xs">
                      No class set
                    </Badge>
                  )}
                </div>
                <CardTitle>{article.title}</CardTitle>
                <CardDescription>{article.subtitle}</CardDescription>
              </CardHeader>

              <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                {/* LEFT SIDE: Admin Controls */}
                <div className="flex flex-col gap-2">
                  {isSuperAdmin ? (
                    <ArticleStatusToggle
                      articleId={article._id}
                      currentStatus={article.status}
                    />
                  ) : (
                    <Badge variant={article.status === 'published' ? 'outline' : 'destructive'}>
                      {article.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  )}

                  {/* Promote toggle for superadmins — only shown on user articles */}
                  {isSuperAdmin && article.isUserArticle && (
                    <ArticlePromoteToggle
                      articleId={article._id}
                      promoted={article.promoted}
                    />
                  )}

                  {/* Content type toggle for superadmins */}
                  {isSuperAdmin && (
                    <ArticleContentTypeToggle
                      articleId={article._id}
                      currentContentType={article.contentType}
                    />
                  )}

                  {canEdit && (
                    <DeleteArticleButton
                      articleId={article._id}
                      articleTitle={article.title}
                    />
                  )}
                </div>

                {/* RIGHT SIDE: Action Buttons */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {article.status === 'published' && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={publicUrl} target="_blank" rel="noopener noreferrer" title="View Live Page">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Link>
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/articles/edit/${article._id}`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                      </Button>
                    )}
                  </div>
                  {canEdit && (
                    <ExportArticleButton
                      articleId={article._id}
                      articlePublicId={article.publicId}
                    />
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {selectedType
              ? `No ${CONTENT_TYPE_LABELS[selectedType as keyof typeof CONTENT_TYPE_LABELS] || selectedType} content found.`
              : 'No content found.'
            }
          </p>
        </div>
      )}
    </div>
  );
}
// components/articles/ArticleCard.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit3,
  Trash2,
  Eye,
  FileText,
  Calendar,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleDTO, ArticleStatus } from "@/lib/services/contracts/IArticleService";

interface ArticleCardProps {
  article: ArticleDTO;
  onEdit: () => void;
  onDelete: () => void;
  onView?: () => void;
}

export default function ArticleCard({
  article,
  onEdit,
  onDelete,
  onView
}: ArticleCardProps) {

  // Get content type color
  const getContentTypeColor = (contentType: string) => {
    const colors = {
      'article': 'bg-blue-500',
      'strategy': 'bg-purple-500',
      'guide': 'bg-green-500',
      'hero': 'bg-red-500',
      'news': 'bg-yellow-500',
      'tournament': 'bg-orange-500'
    };
    return colors[contentType as keyof typeof colors] || 'bg-gray-500';
  };

  // Get status badge variant
  const getStatusVariant = (status: ArticleStatus) => {
    return status === 'published' ? 'default' : 'secondary';
  };

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Count sections
  const sectionCount = article.sections?.length || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 hover:shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
              {article.title}
            </h3>
            {article.subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                {article.subtitle}
              </p>
            )}
          </div>

          {/* Status Badge */}
          <Badge
            variant={getStatusVariant(article.status)}
            className={cn(
              "capitalize shrink-0",
              article.status === 'published' && "bg-green-700 text-white hover:bg-green-800"
            )}
          >
            {article.status}
          </Badge>
        </div>

        {/* Content Type Badge */}
        <div className="flex items-center gap-2 mt-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            getContentTypeColor(article.contentType)
          )} />
          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {article.contentType}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{sectionCount} {sectionCount === 1 ? 'section' : 'sections'}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{formatDate(article.updatedAt)}</span>
          </div>
        </div>

        {article.createdAt && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-2">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Created {formatDate(article.createdAt)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex items-center gap-2">
        {/* View Button (only if published) */}
        {article.status === 'published' && onView && (
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        )}

        {/* Edit Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="flex-1"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit
        </Button>

        {/* Delete Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

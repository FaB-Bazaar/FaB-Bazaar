// components/articles/ArticleStats.tsx
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import type { ArticleDTO } from "@/lib/services/contracts/IArticleService";

interface ArticleStatsProps {
  stats: {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    contentTypeBreakdown: Array<{
      contentType: string;
      count: number;
      publishedCount: number;
    }>;
    recentActivity: ArticleDTO[];
  };
  onViewContentType?: (contentType: string) => void;
}

export default function ArticleStats({ stats, onViewContentType }: ArticleStatsProps) {

  // Get content type color
  const getContentTypeColor = (contentType: string) => {
    const colors = {
      'article': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'strategy': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'guide': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'hero': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'news': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'tournament': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    };
    return colors[contentType as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Articles */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Articles</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalArticles}
              </p>
            </div>
          </div>
        </Card>

        {/* Published */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Published</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.publishedArticles}
              </p>
            </div>
          </div>
        </Card>

        {/* Drafts */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Drafts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.draftArticles}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Content Type Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Content Type Breakdown
        </h3>

        {stats.contentTypeBreakdown.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No articles yet
          </p>
        ) : (
          <div className="space-y-3">
            {stats.contentTypeBreakdown.map((item) => (
              <div
                key={item.contentType}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                onClick={() => onViewContentType && onViewContentType(item.contentType)}
              >
                <div className="flex items-center gap-3">
                  <Badge className={getContentTypeColor(item.contentType)}>
                    {item.contentType}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.count} total
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    {item.publishedCount} published
                  </span>
                  <span className="text-gray-500 dark:text-gray-500">
                    {item.count - item.publishedCount} draft
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Activity
        </h3>

        {stats.recentActivity.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((article) => (
              <div
                key={article._id}
                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={getContentTypeColor(article.contentType)}
                    >
                      {article.contentType}
                    </Badge>
                    <Badge
                      variant={article.status === 'published' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {article.status}
                    </Badge>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap ml-4">
                  {formatDate(article.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

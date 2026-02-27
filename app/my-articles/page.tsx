// app/my-articles/page.tsx - User articles management page
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileText,
  Filter
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { articlesClient } from "@/lib/client";

// Import article-specific components
import ArticleCard from "@/components/articles/ArticleCard";
import ArticleStats from "@/components/articles/ArticleStats";

import type { ArticleDTO, ArticleStatus } from "@/lib/services/contracts/IArticleService";

export default function MyArticlesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Core state
  const [articles, setArticles] = useState<ArticleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContentType, setFilterContentType] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "published">("all");
  const [sortBy, setSortBy] = useState("updated"); // updated, created, title
  const [activeTab, setActiveTab] = useState("articles");

  // Fetch user's articles
  useEffect(() => {
    if (user) {
      fetchArticles();
    }
  }, [user]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await articlesClient.getUserArticles();

      if (result.success) {
        setArticles(result.data.articles || []);
      } else {
        throw new Error(result.error || 'Failed to load articles');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load articles');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle article deletion
  const handleDeleteArticle = async (publicId: string) => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) return;

    try {
      console.log('[My Articles] Deleting article:', publicId);

      const result = await articlesClient.deleteArticle(publicId);

      if (result.success) {
        console.log('[My Articles] Article deleted successfully');

        // Remove from state
        setArticles(prev => prev.filter(article => article.publicId !== publicId));

        toast({
          title: "Article deleted",
          description: "Article has been removed successfully.",
        });
      } else {
        throw new Error(result.error || 'Failed to delete article');
      }
    } catch (err: any) {
      console.error('Failed to delete article:', err);
      toast({
        title: "Error",
        description: "Failed to delete article.",
        variant: "destructive"
      });
    }
  };

  // Filter and sort articles
  const filteredAndSortedArticles = articles
    .filter(article => {
      const matchesSearch = !searchQuery ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.subtitle?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesContentType = filterContentType === "all" || article.contentType === filterContentType;

      const matchesStatus = filterStatus === "all" || article.status === filterStatus;

      return matchesSearch && matchesContentType && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "created":
          return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
        case "updated":
        default:
          return new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime();
      }
    });

  // Get available content types
  const availableContentTypes = Array.from(new Set(articles.map(article => article.contentType)));

  // Calculate stats
  const stats = {
    totalArticles: articles.length,
    publishedArticles: articles.filter(article => article.status === 'published').length,
    draftArticles: articles.filter(article => article.status === 'draft').length,
    contentTypeBreakdown: availableContentTypes.map(contentType => ({
      contentType,
      count: articles.filter(article => article.contentType === contentType).length,
      publishedCount: articles.filter(article => article.contentType === contentType && article.status === 'published').length,
    })),
    recentActivity: articles
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
      .slice(0, 5)
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign In Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Please sign in to manage your articles.</p>
          <Button onClick={() => router.push('/auth')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading articles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Articles</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <Button onClick={fetchArticles} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            My Articles
          </h1>

          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{articles.length} articles</span>
              <span>{stats.publishedArticles} published</span>
              <span>{stats.draftArticles} drafts</span>
            </div>
          </div>

          <Button
            onClick={() => router.push('/my-articles/create')}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Article
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search articles by title or subtitle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={filterContentType}
                onChange={(e) => setFilterContentType(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                {availableContentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>

          {/* Active filters indicator */}
          {(searchQuery || filterContentType !== "all" || filterStatus !== "all") && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredAndSortedArticles.length} of {articles.length} articles
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterContentType("all");
                  setFilterStatus("all");
                }}
                className="ml-auto text-xs"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="articles">
              Articles ({filteredAndSortedArticles.length})
            </TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="space-y-6">
            {filteredAndSortedArticles.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {articles.length === 0 ? "No articles yet" : "No articles match your filters"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {articles.length === 0 ?
                    "Create your first article to start sharing your content" :
                    "Try adjusting your search criteria"
                  }
                </p>
                {articles.length === 0 && (
                  <Button onClick={() => router.push('/my-articles/create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Article
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedArticles.map((article) => (
                  <ArticleCard
                    key={article.publicId}
                    article={article}
                    onEdit={() => router.push(`/my-articles/${article.publicId}`)}
                    onDelete={() => handleDeleteArticle(article.publicId)}
                    onView={article.status === 'published' ? () => window.open(`/articles/${article.publicId}`, '_blank') : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <ArticleStats
              stats={stats}
              onViewContentType={(contentType) => {
                setFilterContentType(contentType);
                setActiveTab("articles");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

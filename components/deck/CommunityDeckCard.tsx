"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Calendar, User, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicDeckSummaryDTO } from "@/lib/services/contracts/IDeckService";
import { displayUsername, profileHref } from "@/lib/utils/display-username";

interface CommunityDeckCardProps {
  deck: PublicDeckSummaryDTO;
  onCopy: (deck: PublicDeckSummaryDTO) => void;
  copying?: boolean;
  showUsername?: boolean;
}

const formatColors: Record<string, string> = {
  'Classic Constructed': 'bg-blue-500',
  'Blitz': 'bg-red-500',
  'Limited': 'bg-green-500',
  'Commoner': 'bg-yellow-500',
  'Living Legend': 'bg-purple-500',
  'Silver Age': 'bg-indigo-500',
};

function timeAgo(date: Date | string | undefined): string {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function CommunityDeckCard({ deck, onCopy, copying, showUsername = true }: CommunityDeckCardProps) {
  const [articlesExpanded, setArticlesExpanded] = useState(false);
  const creatorName = deck.creatorDisplayUsername || deck.creatorUsername || 'Unknown';
  const totalCards = deck.totalCards || 0;
  const estimatedValue = deck.estimatedValue || 0;
  const articleRefs = deck.articleReferences || [];
  const heroImgUrl = deck.heroPrintingId
    ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${deck.heroPrintingId}/public`
    : null;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            {heroImgUrl && (
              <div className="flex-shrink-0">
                <img
                  src={heroImgUrl}
                  alt={deck.heroName || "Hero"}
                  className="w-12 h-16 object-cover rounded"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link
                href={`/decks/${deck.publicId}`}
                className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate block hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={deck.name}
              >
                {deck.name}
              </Link>

              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-white text-xs", formatColors[deck.format] || 'bg-gray-500')}>
                  {deck.format}
                </Badge>
              </div>

              {deck.heroName && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {deck.heroName.replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              )}
            </div>
          </div>

          {deck.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">
              {deck.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="p-4 flex-1">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cards:</span>
              <span className="font-medium">{totalCards}</span>
            </div>
            {estimatedValue > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Value:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  ~${estimatedValue.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            {showUsername ? (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {deck.creatorUsername ? (
                  <Link
                    href={profileHref(deck.creatorUsername)}
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {displayUsername(creatorName)}
                  </Link>
                ) : (
                  <span>{displayUsername(creatorName)}</span>
                )}
              </div>
            ) : <span />}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{timeAgo(deck.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Article References */}
        {articleRefs.length > 0 && (
          <div className="px-4 pb-3">
            {articleRefs.length === 1 ? (
              <Link
                href={`/articles/${articleRefs[0].publicId}`}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <BookOpen className="h-3 w-3" />
                {articleRefs[0].title}
              </Link>
            ) : (
              <div>
                <button
                  onClick={() => setArticlesExpanded(!articlesExpanded)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <BookOpen className="h-3 w-3" />
                  Featured in {articleRefs.length} articles
                  {articlesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {articlesExpanded && (
                  <div className="mt-1.5 space-y-1 pl-4.5">
                    {articleRefs.map((ref) => (
                      <Link
                        key={ref.publicId}
                        href={`/articles/${ref.publicId}`}
                        className="block text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        {ref.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-1"
            >
              <Link href={`/decks/${deck.publicId}`}>
                View Deck
              </Link>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onCopy(deck)}
              disabled={copying}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-1" />
              {copying ? 'Copying...' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

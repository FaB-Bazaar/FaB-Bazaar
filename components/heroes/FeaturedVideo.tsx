//components/heroes/FeaturedVideo.tsx
import React from 'react';
import { Youtube, Link as LinkIcon } from 'lucide-react'; // Import a Link icon for attribution

// 1. UPDATE THE PROPS INTERFACE
interface FeaturedVideoProps {
  videoId: string;
  title: string;
  description: string;
  creatorName?: string; // New optional prop for the creator's name
  creatorUrl?: string;  // New optional prop for the link to their channel/site
}

/**
 * A component for embedding a featured YouTube video with a title, description,
 * and an optional, clickable attribution link to the content creator.
 */
export default function FeaturedVideo({ videoId, title, description, creatorName, creatorUrl }: FeaturedVideoProps) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div className="not-prose my-12 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800/50">
      <div className="aspect-video">
        <iframe
          src={embedUrl}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-3">
          <Youtube className="h-6 w-6 text-red-500 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
            {creatorName && creatorUrl && (
              <a 
                href={creatorUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-primary dark:text-slate-400">
                <LinkIcon className="h-3 w-3" />
                <span>Credit: {creatorName}</span>
              </a>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
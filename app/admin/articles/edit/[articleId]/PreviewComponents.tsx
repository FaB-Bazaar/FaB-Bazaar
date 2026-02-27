// app/admin/articles/edit/[articleId]/PreviewComponents.tsx
"use client";

import React from 'react';
import { Lightbulb, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

// These are client-safe preview versions of your hero components
// They match the actual component structure and appearance

export const PreviewHeroCard = ({ printingId, ...props }: any) => (
  <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
    {/* Card Image */}
    <div className="relative aspect-[63/88] w-full bg-gray-100 dark:bg-gray-700">
      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-20 bg-white dark:bg-gray-700 rounded border-2 border-dashed border-gray-400 mx-auto mb-2 flex items-center justify-center">
            <span className="text-xs text-gray-500">IMG</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">{printingId || 'card-id'}</div>
        </div>
      </div>
    </div>
    
    {/* Card Info */}
    <div className="p-3 flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold text-sm leading-tight mb-1 text-gray-900 dark:text-gray-100">
            Sample Card Name
          </h3>
          <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1" title="Red"></div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-b border-gray-200 dark:border-gray-700 py-2 my-2">
          <div className="flex flex-col">
            <span className="font-mono">SET</span>
            <span className="text-gray-800 dark:text-gray-300 font-semibold">Set Name</span>
          </div>
          <div className="h-8 border-l border-gray-200 dark:border-gray-700 mx-2"></div>
          <div className="flex flex-col text-right">
            <span className="font-bold text-lg text-green-600 dark:text-green-400">$12.34</span>
            <span className="text-[10px] -mt-1 text-green-700 dark:text-green-600">TCG Low</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const PreviewInlineCard = ({ printingId, children, ...props }: any) => {
  // Match the actual InlineCard appearance
  if (children) {
    return <span className="cursor-pointer underline decoration-primary/50 decoration-dotted underline-offset-2">{children}</span>;
  }
  
  return (
    <span className="font-semibold text-primary underline decoration-primary/50 decoration-dotted underline-offset-2 cursor-pointer">
      {printingId ? `Card ${printingId}` : 'Sample Card'}
    </span>
  );
};

export const PreviewCardGrid = ({ children, className, ...props }: any) => (
  <div className={`not-prose my-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${className || ''}`}>
    {children || (
      // Show placeholder cards if no children
      <>
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[63/88] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg border flex items-center justify-center">
            <span className="text-sm text-gray-500">Card {i}</span>
          </div>
        ))}
      </>
    )}
  </div>
);

export const PreviewCardCarousel = ({ children, ...props }: any) => (
  <div className="not-prose my-8 relative group max-w-6xl mx-auto">
    <div className="w-full px-12">
      <div className="flex gap-4 overflow-x-auto px-3">
        {children || (
          // Show placeholder cards if no children
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex-none w-48 aspect-[63/88] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg border flex items-center justify-center">
                <span className="text-sm text-gray-500">Card {i}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
    
    {/* Carousel arrows */}
    <div className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-50 h-10 w-10 bg-white dark:bg-gray-800 rounded-full border items-center justify-center">
      <ChevronLeft className="h-4 w-4" />
    </div>
    <div className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-50 h-10 w-10 bg-white dark:bg-gray-800 rounded-full border items-center justify-center">
      <ChevronRight className="h-4 w-4" />
    </div>
  </div>
);

export const PreviewCardRow = ({ children, ...props }: any) => (
  <div className="not-prose my-8 flex gap-4 overflow-x-auto">
    {children || (
      // Show placeholder cards if no children
      <>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-none w-32 aspect-[63/88] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg border flex items-center justify-center">
            <span className="text-xs text-gray-500">Card {i}</span>
          </div>
        ))}
      </>
    )}
  </div>
);

export const PreviewCallout = ({ title, text, linkHref, linkText, children, ...props }: any) => (
  <div className="not-prose my-8 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-lg border bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
    <div className="flex items-start gap-4">
      <div className="text-primary mt-1 flex-shrink-0">
        <Lightbulb className="h-6 w-6" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">
          {title || 'Callout Title'}
        </h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {text || children || 'Callout description text would appear here.'}
        </p>
      </div>
    </div>
    <div className="flex-shrink-0 w-full sm:w-auto">
      <div className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto">
        {linkText || 'Call to Action'}
        <ExternalLink className="ml-2 h-4 w-4" />
      </div>
    </div>
  </div>
);

// export const PreviewResourceLinks = ({ links, title, ...props }: any) => (
//   <div className="p-4 border-2 border-dashed border-teal-300 bg-teal-50 dark:bg-teal-950 rounded-lg my-4">
//     <strong>[ResourceLinks Preview]</strong>
//     {title && <div className="font-semibold mt-2">{title}</div>}
//     <div className="text-sm mt-2">
//       <div>Links: {Array.isArray(links) ? links.length : 'N/A'} items</div>
//       {Array.isArray(links) && (
//         <ul className="mt-2 space-y-1">
//           {links.map((link: any, i: number) => (
//             <li key={i} className="text-xs">
//               • {link.title || link.text || `Link ${i + 1}`} → {link.url || '#'}
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   </div>
// );

// export const PreviewFeaturedVideo = ({ videoId, title, ...props }: any) => (
//   <div className="p-4 border-2 border-dashed border-pink-300 bg-pink-50 dark:bg-pink-950 rounded-lg my-4">
//     <strong>[FeaturedVideo Preview]</strong>
//     <div className="text-sm mt-2">
//       <div>Video ID: {videoId || 'Not specified'}</div>
//       <div>Title: {title || 'No title'}</div>
//     </div>
//     <div className="mt-2 aspect-video bg-black rounded flex items-center justify-center text-white">
//       🎥 Video Player Placeholder
//     </div>
//   </div>
// );

// export const PreviewCreatorSpotlight = ({ children, creator, ...props }: any) => (
//   <div className="p-4 border-2 border-dashed border-indigo-300 bg-indigo-50 dark:bg-indigo-950 rounded-lg my-4">
//     <strong>[CreatorSpotlight Preview]</strong>
//     <div className="text-sm mt-2">
//       <div>Creator: {creator || 'Not specified'}</div>
//     </div>
//     <div className="mt-2">{children}</div>
//   </div>
// );

// export const PreviewSpotlightHeader = ({ children, ...props }: any) => (
//   <div className="font-bold text-lg mb-2">[SpotlightHeader] {children}</div>
// );

// export const PreviewSpotlightLinks = ({ children, ...props }: any) => (
//   <div className="space-y-1">[SpotlightLinks] {children}</div>
// );

export const PreviewResourceLinks = ({ slug, ...props }: any) => (
  <div className="not-prose my-12">
    <h3 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4 dark:text-slate-100 dark:border-slate-700">
      Further Resources
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Sample resource links */}
      <div className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="text-primary">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">📚</div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">Sample Decklist</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">Example resource for slug: {slug || 'not-specified'}</p>
        </div>
      </div>
      <div className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="text-red-500">
          <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">🎥</div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">Sample Video Guide</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">Another example resource</p>
        </div>
      </div>
    </div>
  </div>
);

export const PreviewFeaturedVideo = ({ videoId, title, description, creatorName, creatorUrl, ...props }: any) => (
  <div className="not-prose my-12 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800/50">
    <div className="aspect-video bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">▶</span>
        </div>
        <div className="text-sm opacity-75">YouTube Video Preview</div>
        <div className="text-xs opacity-50 mt-1">ID: {videoId || 'sample-video-id'}</div>
      </div>
    </div>
    <div className="p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-white text-xs">Y</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title || 'Sample Video Title'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {description || 'Video description would appear here.'}
          </p>
          {(creatorName || creatorUrl) && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>🔗</span>
              <span>Credit: {creatorName || 'Creator Name'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export const PreviewCreatorSpotlight = ({ children, imageUrl, ...props }: any) => {
  const childrenArray = React.Children.toArray(children);
  const [header, links] = childrenArray;

  return (
    <div className="not-prose my-8 rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg overflow-hidden dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-1 bg-white rounded-full shadow-sm dark:bg-slate-800 flex-shrink-0">
            {imageUrl ? (
              <div className="w-[70px] h-[70px] rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                IMG
              </div>
            ) : (
              <div className="h-10 w-10 flex items-center justify-center">
                <span className="text-indigo-600 dark:text-indigo-400">👤</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            {header || (
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Creator Name</h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Creator description would appear here.
                </div>
              </div>
            )}
            {links || (
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                  🔗 Sample Link
                </div>
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                  ❤️ Patreon
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PreviewSpotlightHeader = ({ name, children, ...props }: any) => (
  <div>
    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{name || 'Creator Name'}</h3>
    <div className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
      {children || 'Creator description and bio information would appear here.'}
    </div>
  </div>
);

export const PreviewSpotlightLinks = ({ children, ...props }: any) => (
  <div className="flex flex-wrap gap-3 mt-4">
    {children || (
      <>
        <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
          📄 Sample Link 1
        </div>
        <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
          ❤️ Sample Link 2
        </div>
      </>
    )}
  </div>
);

export const PreviewSpotlightLink = ({ href, icon, children, ...props }: any) => {
  const getIconEmoji = (iconType?: string) => {
    switch (iconType) {
      case 'decklist': return '📄';
      case 'patreon': return '❤️';
      case 'discord': return '💬';
      case 'guide': return '📚';
      default: return '🔗';
    }
  };

  return (
    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
      <span className="mr-2">{getIconEmoji(icon)}</span>
      {children || 'Link Text'}
    </div>
  );
};
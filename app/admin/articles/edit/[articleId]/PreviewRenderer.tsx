// app/admin/articles/edit/[articleId]/PreviewRenderer.tsx
"use client";

import React, { useMemo } from 'react';
import { serialize } from 'next-mdx-remote/serialize';
import { MDXRemote } from 'next-mdx-remote';
import type { MDXRemoteSerializeResult } from 'next-mdx-remote';

// --- PREVIEW COMPONENT IMPORTS (Client-Safe Versions) ---
import {
  PreviewHeroCard,
  PreviewInlineCard,
  PreviewCardGrid,
  PreviewCardCarousel,
  PreviewCardRow,
  PreviewCallout,
  PreviewResourceLinks,
  PreviewFeaturedVideo,
  PreviewCreatorSpotlight,
  PreviewSpotlightHeader,
  PreviewSpotlightLinks,
  PreviewSpotlightLink,
} from './PreviewComponents';

const components = {
  HeroCard: PreviewHeroCard, 
  InlineCard: PreviewInlineCard, 
  CardGrid: PreviewCardGrid, 
  CardCarousel: PreviewCardCarousel, 
  CardRow: PreviewCardRow, 
  Callout: PreviewCallout,
  ResourceLinks: PreviewResourceLinks, 
  FeaturedVideo: PreviewFeaturedVideo, 
  CreatorSpotlight: PreviewCreatorSpotlight, 
  SpotlightHeader: PreviewSpotlightHeader,
  SpotlightLinks: PreviewSpotlightLinks, 
  SpotlightLink: PreviewSpotlightLink,
};

interface PreviewRendererProps {
  source: string;
}

export function PreviewRenderer({ source }: PreviewRendererProps) {
  const [serializedMdx, setSerializedMdx] = React.useState<MDXRemoteSerializeResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    async function compileMdx() {
      if (!source || source.trim() === '') {
        setSerializedMdx(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const mdxSource = await serialize(source, {
          // SECURITY: Block dangerous JavaScript expressions (CVE-2026-0969)
          blockDangerousJS: true,
          // You can add remark/rehype plugins here if needed
          mdxOptions: {
            remarkPlugins: [],
            rehypePlugins: [],
          },
        });
        setSerializedMdx(mdxSource);
      } catch (err) {
        console.error('MDX compilation error:', err);
        setError(err instanceof Error ? err.message : 'Failed to compile MDX');
        setSerializedMdx(null);
      } finally {
        setIsLoading(false);
      }
    }

    compileMdx();
  }, [source]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
        <span className="ml-3">Compiling preview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <h4 className="font-semibold text-destructive mb-2">MDX Compilation Error</h4>
        <pre className="text-sm text-destructive/80 whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!serializedMdx) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No content to preview</p>
      </div>
    );
  }

  return (
    <div className="prose prose-custom dark:prose-invert max-w-none">
      <MDXRemote {...serializedMdx} components={components} />
    </div>
  );
}
// // app/admin/articles/edit/[articleId]/PreviewRenderer.tsx
// "use client";

// import React, { useMemo } from 'react';
// import { serialize } from 'next-mdx-remote/serialize';
// import { MDXRemote } from 'next-mdx-remote';
// import type { MDXRemoteSerializeResult } from 'next-mdx-remote';

// // --- COMPONENT IMPORTS ---
// import HeroCard from '@/components/heroes/HeroCard';
// import InlineCard from '@/components/heroes/InlineCard';
// import CardGrid from '@/components/heroes/CardGrid'; 
// import CardCarousel from '@/components/heroes/CardCarousel'; 
// import CardRow from '@/components/heroes/CardRow'; 
// import Callout from '@/components/heroes/Callout';
// import ResourceLinks from '@/components/heroes/ResourceLinks';
// import FeaturedVideo from '@/components/heroes/FeaturedVideo';
// import CreatorSpotlight, { SpotlightHeader, SpotlightLinks, SpotlightLink } from '@/components/heroes/CreatorSpotlight';

// const components = {
//   HeroCard, 
//   InlineCard, 
//   CardGrid, 
//   CardCarousel, 
//   CardRow, 
//   Callout,
//   ResourceLinks, 
//   FeaturedVideo, 
//   CreatorSpotlight, 
//   SpotlightHeader,
//   SpotlightLinks, 
//   SpotlightLink,
// };

// interface PreviewRendererProps {
//   source: string;
// }

// export function PreviewRenderer({ source }: PreviewRendererProps) {
//   const [serializedMdx, setSerializedMdx] = React.useState<MDXRemoteSerializeResult | null>(null);
//   const [error, setError] = React.useState<string | null>(null);
//   const [isLoading, setIsLoading] = React.useState(false);

//   React.useEffect(() => {
//     async function compileMdx() {
//       if (!source || source.trim() === '') {
//         setSerializedMdx(null);
//         setError(null);
//         return;
//       }

//       setIsLoading(true);
//       setError(null);

//       try {
//         const mdxSource = await serialize(source, {
//           // You can add remark/rehype plugins here if needed
//           mdxOptions: {
//             remarkPlugins: [],
//             rehypePlugins: [],
//           },
//         });
//         setSerializedMdx(mdxSource);
//       } catch (err) {
//         console.error('MDX compilation error:', err);
//         setError(err instanceof Error ? err.message : 'Failed to compile MDX');
//         setSerializedMdx(null);
//       } finally {
//         setIsLoading(false);
//       }
//     }

//     compileMdx();
//   }, [source]);

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center p-8 text-muted-foreground">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
//         <span className="ml-3">Compiling preview...</span>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
//         <h4 className="font-semibold text-destructive mb-2">MDX Compilation Error</h4>
//         <pre className="text-sm text-destructive/80 whitespace-pre-wrap">{error}</pre>
//       </div>
//     );
//   }

//   if (!serializedMdx) {
//     return (
//       <div className="p-8 text-center text-muted-foreground">
//         <p>No content to preview</p>
//       </div>
//     );
//   }

//   return (
//     <div className="prose prose-custom dark:prose-invert max-w-none">
//       <MDXRemote {...serializedMdx} components={components} />
//     </div>
//   );
// }
// // // app/admin/articles/edit/[articleId]/PreviewRenderer.tsx
// // "use client";

// // import { MDXRemote } from 'next-mdx-remote';
// // // --- COMPONENT IMPORTS (These remain the same) ---
// // import HeroCard from '@/components/heroes/HeroCard';
// // import InlineCard from '@/components/heroes/InlineCard';
// // import CardGrid from '@/components/heroes/CardGrid'; 
// // import CardCarousel from '@/components/heroes/CardCarousel'; 
// // import CardRow from '@/components/heroes/CardRow'; 
// // import Callout from '@/components/heroes/Callout';
// // import ResourceLinks from '@/components/heroes/ResourceLinks';
// // import FeaturedVideo from '@/components/heroes/FeaturedVideo';
// // import CreatorSpotlight, { SpotlightHeader, SpotlightLinks, SpotlightLink } from '@/components/heroes/CreatorSpotlight';

// // const components = {
// //   HeroCard, InlineCard, CardGrid, CardCarousel, CardRow, Callout,
// //   ResourceLinks, FeaturedVideo, CreatorSpotlight, SpotlightHeader,
// //   SpotlightLinks, SpotlightLink,
// // };

// // // This component uses a different MDX library (`next-mdx-remote`)
// // // that is designed to work on the client side for previews.
// // export function PreviewRenderer({ source }: { source: string }) {
// //   // You may need to install this with `pnpm add next-mdx-remote`
// //   return <MDXRemote source={source} components={components} />;
// // }
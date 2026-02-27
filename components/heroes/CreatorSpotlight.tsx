import React from 'react';
import Image from 'next/image'; // Import the Next.js Image component for optimization
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, ExternalLink, Heart, MessageCircle, FileText, BookOpen, GraduationCap } from 'lucide-react';

// ============================================================================
// 1. The Main Layout Component (UPDATED)
// ============================================================================

// --- FIX 1: Add an optional 'imageUrl' prop ---
export function CreatorSpotlight({ 
  children,
  imageUrl 
}: { 
  children: React.ReactNode;
  imageUrl?: string; // The URL for the creator's photo
}) {
  const [header, links] = React.Children.toArray(children);

  return (
    <div className="not-prose my-8 rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg overflow-hidden dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
      <div className="p-6">
        <div className="flex items-start gap-4">
          
          {/* --- FIX 2: Conditionally render the image or the icon --- */}
          <div className="p-1 bg-white rounded-full shadow-sm dark:bg-slate-800 flex-shrink-0">
            {imageUrl ? (
              // If an imageUrl is provided, use the Next.js Image component
              <Image
                src={imageUrl}
                alt="Creator avatar" // Alt text for accessibility
                width={70} // Specify width
                height={70} // Specify height
                className="rounded-full object-cover" // Style it
              />
            ) : (
              <div className="h-10 w-10 flex items-center justify-center">
                <User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
          </div>
          {/* --- END FIX --- */}

          <div className="flex-1">
            {header}
            {links}
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// 2. The SpotlightHeader Sub-Component (Unchanged)
// ============================================================================
export function SpotlightHeader({ name, children }: { name: string, children: React.ReactNode }) {
    return (
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{name}</h3>
        {/* The <p> is now a <div>, and I've cleaned up the className */}
        <div className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          {children}
        </div>
      </div>
    );
  }

// ============================================================================
// 3. The SpotlightLinks Sub-Component (Unchanged)
// ============================================================================
export function SpotlightLinks({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {children}
    </div>
  );
}

// ============================================================================
// 4. The NEW SpotlightLink Sub-Component (Your excellent idea!)
// Use this inside SpotlightLinks to create individual link buttons.
// ============================================================================

// Helper function to map the icon prop to a component
const getLinkIcon = (icon?: string) => {
  switch (icon) {
    case 'decklist': return <FileText className="h-4 w-4 mr-2" />;
    case 'patreon': return <Heart className="h-4 w-4 mr-2" />;
    case 'discord': return <MessageCircle className="h-4 w-4 mr-2" />;
    case 'guide': return <BookOpen className="h-4 w-4 mr-2" />;
    case 'metafy': return <GraduationCap className="h-4 w-4 mr-2" />;
    default: return <ExternalLink className="h-4 w-4 mr-2" />;
  }
};

export function SpotlightLink({
  href,
  icon,
  children
}: {
  href: string;
  icon?: 'decklist' | 'patreon' | 'discord' | 'guide' | 'metafy' | 'external';
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline" className="dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {getLinkIcon(icon)}
        {children}
      </a>
    </Button>
  );
}

// Default export is the main wrapper component
export default CreatorSpotlight;
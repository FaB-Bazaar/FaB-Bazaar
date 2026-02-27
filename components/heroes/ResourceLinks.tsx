import React from 'react';
import { Youtube, Library } from 'lucide-react';
// 1. We import the data fetching logic from your central data file
import { ResourceLink } from '@/lib/fab-constants';

// 2. The component now correctly expects a 'slug' prop
interface ResourceLinksProps {
  slug: string;
}

const iconMap = {
  decklist: <Library className="h-8 w-8 text-primary" />,
  video: <Youtube className="h-8 w-8 text-red-500" />,
};

export default function ResourceLinks({ slug }: ResourceLinksProps) {
  // Feature removed - getHeroResources no longer exists
  return null;

  return (
    <div className="not-prose my-12">
      <h3 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4 dark:text-slate-100 dark:border-slate-700">Further Resources</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {resources.map((resource: ResourceLink) => (
          <a 
            key={resource.href}
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary dark:border-slate-700 dark:bg-slate-800/50">
            <div>{iconMap[resource.type]}</div>
            <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{resource.title}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{resource.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
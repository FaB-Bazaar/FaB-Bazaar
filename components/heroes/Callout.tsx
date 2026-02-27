import React from 'react';
import { Lightbulb, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button'; // We'll use a Button for the CTA

interface CalloutProps {
  // We no longer need children, as the content will be passed via props for structure.
  title: string;
  text: string;
  linkHref: string;
  linkText: string;
}

/**
 * A redesigned callout component with a clear two-column layout and a prominent
 * call-to-action button, improving scannability and user engagement.
 */
export default function Callout({ title, text, linkHref, linkText }: CalloutProps) {
    return (
      <div className="not-prose my-8 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-lg border bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start gap-4">
          <div className="text-primary mt-1 flex-shrink-0">
            <Lightbulb className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{text}</p>
        </div>
      </div>
      <div className="flex-shrink-0 w-full sm:w-auto">
        <Button asChild className="w-full sm:w-auto">
          <a href={linkHref} target="_blank" rel="noopener noreferrer">
            {linkText}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
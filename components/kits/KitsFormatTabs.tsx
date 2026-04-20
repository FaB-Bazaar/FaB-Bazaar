"use client";

import Link from 'next/link';
import { KIT_FORMAT_SLUGS, FORMAT_SLUG_TO_NAME } from '@/lib/utils/kit-slugs';

interface Props {
  selectedSlug: string;
}

export default function KitsFormatTabs({ selectedSlug }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {KIT_FORMAT_SLUGS.map(slug => {
        const active = slug === selectedSlug;
        return (
          <Link
            key={slug}
            href={`/kits?format=${slug}`}
            className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-border bg-card text-foreground hover:border-blue-400'
            }`}
          >
            {FORMAT_SLUG_TO_NAME[slug]}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import Link from 'next/link';

interface Props {
  formatSlug: string;
  selected: 'heroes' | 'pool';
}

export default function KitsViewToggle({ formatSlug, selected }: Props) {
  const options: Array<{ key: 'heroes' | 'pool'; label: string }> = [
    { key: 'heroes', label: 'By hero' },
    { key: 'pool', label: 'All cards' },
  ];

  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {options.map(opt => {
        const active = opt.key === selected;
        const query = opt.key === 'heroes'
          ? `?format=${formatSlug}`
          : `?format=${formatSlug}&view=pool`;
        return (
          <Link
            key={opt.key}
            href={`/kits${query}`}
            className={`h-9 px-3 inline-flex items-center text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-card text-foreground hover:bg-accent'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

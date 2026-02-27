// components/KeywordBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KeywordBadgeProps {
  keyword: string;
  size?: 'sm' | 'md';
}

export function KeywordBadge({ keyword, size = 'sm' }: KeywordBadgeProps) {
  // Special case for "go again" - capitalize as "Go again" not "Go Again"
  const formatted = keyword.toLowerCase() === 'go again'
    ? 'Go again'
    : keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  return (
    <Badge
      variant="secondary"
      className={cn(
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      )}
    >
      {formatted}
    </Badge>
  );
}

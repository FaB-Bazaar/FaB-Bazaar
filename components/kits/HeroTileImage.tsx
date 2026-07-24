'use client';

import { useState } from 'react';

interface Props {
  src?: string;
  alt: string;
  /** Shown when there is no image or the CDN 404s (e.g. a just-ingested set). */
  fallbackLabel: string;
}

export default function HeroTileImage({ src, alt, fallbackLabel }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground uppercase tracking-widest">
        {fallbackLabel}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

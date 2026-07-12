'use client';

/**
 * "Present" overlay — the deck page's spotlight feel (dim backdrop, big
 * readable cards), rebuilt as a dumb client component so Volzar can mount it
 * from anywhere: AI search result cards, tile clicks, the tile action menu.
 *
 * Deliberately zero coupling: takes a plain card list, no deck-page state, no
 * window events, no FLIP animation. Esc / click / the ✕ button close it.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface SpotlightCard {
  name: string;
  imageUrl?: string;
  qty?: number;
}

export function CardSpotlightOverlay({ title, cards, onClose }: {
  title?: string;
  cards: SpotlightCard[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Capture phase + stopPropagation: Esc must close THIS layer only,
        // not also clear pickers/menus underneath it.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const single = cards.length === 1;
  const count = cards.reduce((sum, c) => sum + (c.qty ?? 1), 0);

  return createPortal(
    <div
      data-testid="card-spotlight"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Presenting: ${title}` : 'Card spotlight'}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/85 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 text-white">
        <span className="text-sm font-bold">{count} {count === 1 ? 'card' : 'cards'}</span>
        {title && <span className="min-w-0 truncate text-sm text-white/70">{title}</span>}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close spotlight"
          className="ml-auto rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className={`flex flex-wrap items-start justify-center gap-x-5 gap-y-6 px-6 pb-10 ${single ? 'pt-[4vh]' : 'pt-1'}`}>
        {cards.map((c, i) => (
          <figure key={`${c.name}-${i}`} className={single ? 'w-[min(26rem,86vw)]' : 'w-[clamp(11rem,17vw,15rem)]'}>
            <span className="relative block">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="block w-full max-w-none rounded-[4.5%/3.5%] shadow-2xl ring-1 ring-white/20"
                />
              ) : (
                <span
                  className="flex w-full items-center justify-center rounded-lg bg-gray-800 p-4 text-center text-sm text-white/90 ring-1 ring-white/20"
                  style={{ aspectRatio: '450/628' }}
                >
                  {c.name}
                </span>
              )}
              {typeof c.qty === 'number' && c.qty > 1 && (
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-bold text-white ring-1 ring-white/30">
                  {c.qty}×
                </span>
              )}
            </span>
            <figcaption className="mt-1.5 truncate text-center text-xs text-white/80">
              {typeof c.qty === 'number' && c.qty > 1 ? `${c.qty}× ` : ''}{c.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  );
}

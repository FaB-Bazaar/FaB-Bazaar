'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { groupDeckViewByPitch, type DeckViewCard } from '@/lib/deck/analytics';

const SECTION_ACCENT: Record<string, string> = {
  red: 'text-red-600 dark:text-red-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  blue: 'text-blue-600 dark:text-blue-400',
  colorless: 'text-gray-500 dark:text-gray-400',
};

/**
 * In-chat "View as cards" overlay: renders a deck / archetype consensus as a
 * card-image grid grouped by pitch (Red / Yellow / Blue / Colorless), with
 * ×qty badges. Click a tile to enlarge; arrows / Esc navigate.
 */
export function DeckCardsOverlay({
  title,
  cards,
  onClose,
}: {
  title: string;
  cards: DeckViewCard[];
  onClose: () => void;
}) {
  const sections = useMemo(() => groupDeckViewByPitch(cards), [cards]);
  const flat = useMemo(() => sections.flatMap((s) => s.cards), [sections]);
  const [spotlightIdx, setSpotlightIdx] = useState<number | null>(null);
  const spotlight = spotlightIdx !== null ? flat[spotlightIdx] : null;

  const step = useCallback((d: number) => {
    setSpotlightIdx((i) => (i === null ? null : Math.min(flat.length - 1, Math.max(0, i + d))));
  }, [flat.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { spotlightIdx !== null ? setSpotlightIdx(null) : onClose(); }
      else if (spotlightIdx !== null && e.key === 'ArrowRight') step(1);
      else if (spotlightIdx !== null && e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spotlightIdx, step, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex flex-col w-full max-w-5xl max-h-[88vh] rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="font-semibold truncate">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {sections.map((section) => (
            <section key={section.key}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className={`text-sm font-bold uppercase tracking-wide ${SECTION_ACCENT[section.key]}`}>{section.title}</h3>
                <span className="text-xs text-gray-500">
                  ({section.cards.reduce((s, c) => s + (c.quantity || 1), 0)})
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {section.cards.map((c, i) => {
                  const idx = flat.indexOf(c);
                  return (
                    <button
                      key={`${c.printingId ?? c.name}-${i}`}
                      type="button"
                      onClick={() => setSpotlightIdx(idx)}
                      title={`${c.quantity}× ${c.name}`}
                      className="group relative aspect-[63/88] rounded-lg overflow-hidden ring-1 ring-border hover:ring-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 bg-muted"
                    >
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.name} loading="lazy" className="w-full h-full object-cover object-top transition-transform group-hover:scale-[1.03]" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] text-gray-500">{c.name}</span>
                      )}
                      {(c.quantity || 1) > 1 && (
                        <span
                          aria-label={`${c.quantity} copies`}
                          className="absolute bottom-1 right-1 min-w-[26px] h-6 px-1.5 rounded-full bg-blue-600/95 ring-2 ring-white/80 text-white text-xs font-black flex items-center justify-center shadow"
                        >
                          ×{c.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {sections.length === 0 && <p className="text-sm text-gray-500">No cards to show.</p>}
        </div>
      </div>

      {/* Enlarge spotlight */}
      {spotlight && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-6"
          onClick={(e) => { e.stopPropagation(); setSpotlightIdx(null); }}
        >
          {spotlightIdx! > 0 && (
            <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); step(-1); }}
              className="absolute left-4 lg:left-10 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-gray-900/80 border border-gray-700 text-gray-200 hover:text-white flex items-center justify-center">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {spotlightIdx! < flat.length - 1 && (
            <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); step(1); }}
              className="absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-gray-900/80 border border-gray-700 text-gray-200 hover:text-white flex items-center justify-center">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {spotlight.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spotlight.imageUrl} alt={spotlight.name} className="max-h-[78vh] w-auto rounded-2xl shadow-2xl ring-1 ring-white/10" />
            ) : (
              <div className="text-gray-100 text-lg">{spotlight.name}</div>
            )}
            <div className="text-gray-100 text-sm font-medium">
              {(spotlight.quantity || 1) > 1 ? `${spotlight.quantity}× ` : ''}{spotlight.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

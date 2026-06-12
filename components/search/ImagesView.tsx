'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TcgAffiliateLink } from '@/components/tracking';
import { FOILING_STYLES, EDITION_MAP } from '@/lib/fab-constants';
import { Minus, Plus, Check, Expand, X } from 'lucide-react';
import FoilCardImage from '@/components/shared/FoilCardImage';
import { artStylesFromPrinting, foilInsetFromValues } from '@/lib/foil';
import { languageFlag } from '@/lib/utils/printing-language';

interface ImagesViewProps {
  printings: any[];
  onToggleSelection?: (printing: any) => void;
  isCardSelected?: (printingId: string) => boolean;
  getCardQuantity?: (printingId: string) => number;
  onUpdateQuantity?: (printingId: string, quantity: number) => void;
}

// Helper to get edition display name
const getEditionDisplay = (edition?: string): string => {
  if (!edition) return '';
  const editionKey = edition.toLowerCase() as keyof typeof EDITION_MAP;
  const editionName = EDITION_MAP[editionKey];

  if (editionName) {
    // Abbreviate for compact display
    if (editionName === 'First Edition') return '1st';
    if (editionName === 'Unlimited') return 'UNL';
    if (editionName === 'Alpha') return 'Alpha';
    return editionName;
  }

  return edition.toUpperCase();
};

// Helper to get foiling display
const getFoilingDisplay = (foiling?: string): { shortName: string; className: string } => {
  if (!foiling) return { shortName: '', className: '' };

  const foilingKey = foiling.toLowerCase() as keyof typeof FOILING_STYLES;
  const foilingStyle = FOILING_STYLES[foilingKey];

  if (foilingStyle) {
    return { shortName: foilingStyle.shortName, className: foilingStyle.className };
  }

  return { shortName: foiling.toUpperCase(), className: 'bg-gray-500 text-white' };
};

export function ImagesView({
  printings,
  onToggleSelection,
  isCardSelected,
  getCardQuantity,
  onUpdateQuantity,
}: ImagesViewProps) {
  const selectionEnabled = onToggleSelection && isCardSelected && getCardQuantity && onUpdateQuantity;

  // Calm preview modal (replaces the old click-to-flip popover on search)
  const [previewPrinting, setPreviewPrinting] = useState<any | null>(null);

  useEffect(() => {
    if (!previewPrinting) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewPrinting(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewPrinting]);

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {printings.map((printing: any) => {
        const isSelected = selectionEnabled && isCardSelected(printing.printing_id);
        const quantity = selectionEnabled ? getCardQuantity(printing.printing_id) : 1;

        return (
          <div key={printing.printing_id} className="group relative flex flex-col">
            {/* Info badge - Collector Number, Edition, Foiling */}
            <div className="mb-1.5 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-1 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2 text-xs">
                {/* Left: Collector Number as Link */}
                <Link
                  href={`/printing/${printing.printing_id}`}
                  className="flex items-center gap-1 font-mono font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {printing.collector_number || '—'}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>

                {/* Right: Language, Edition and Foiling */}
                <div className="flex items-center gap-1.5">
                  {(() => {
                    // Missing language = English (matches the printings.language DB default)
                    const lang = (printing.language || 'en').toLowerCase();
                    return (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400" title={lang.toUpperCase()}>
                        <span aria-hidden="true">{languageFlag(lang)}</span>
                        <span>{lang.toUpperCase()}</span>
                      </span>
                    );
                  })()}
                  {printing.edition && (
                    <span className="text-[10px] text-gray-600 dark:text-gray-400">
                      {getEditionDisplay(printing.edition)}
                    </span>
                  )}
                  {printing.foiling && (() => {
                    const foilingDisplay = getFoilingDisplay(printing.foiling);
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${foilingDisplay.className}`}>
                        {foilingDisplay.shortName}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="relative">
              <div
                {...(selectionEnabled
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-pressed': !!isSelected,
                      'aria-label': `Select ${printing.display_name || printing.name}`,
                      onClick: () => onToggleSelection(printing),
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onToggleSelection(printing);
                        }
                      },
                    }
                  : {})}
                className={`relative aspect-[2.5/3.5] rounded-lg overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400'
                    : 'border-gray-200 dark:border-gray-700'
                }${selectionEnabled ? ' cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400' : ''}`}
              >
                  {printing.image_url ? (
                    <FoilCardImage
                      foiling={printing.foiling}
                      artStyle={artStylesFromPrinting(printing.art_variations, printing.is_extended_art)}
                      foilInset={foilInsetFromValues(printing.foil_inset_top, printing.foil_inset_right, printing.foil_inset_bottom, printing.foil_inset_left, printing.foil_inset_round)}
                      src={printing.image_url}
                      alt={printing.display_name || printing.name}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500 text-sm text-center px-2">
                        {printing.display_name || printing.name}
                      </span>
                    </div>
                  )}
                </div>

              {/* Selected badge - top-left corner (pairs the blue ring with a shape cue) */}
              {isSelected && (
                <div
                  data-testid="selected-badge"
                  className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-blue-600 border-2 border-white dark:border-gray-900 shadow-md flex items-center justify-center pointer-events-none"
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={3} aria-hidden="true" />
                </div>
              )}

              {/* Magnifier - opens the calm preview modal (hover-reveal; always shown on touch) */}
              <button
                type="button"
                aria-label={`Preview ${printing.display_name || printing.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewPrinting(printing);
                }}
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-md bg-black/50 text-white/90 hover:bg-black/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Expand className="w-4 h-4" aria-hidden="true" />
              </button>

              {/* Quantity selector - bottom-center pill, only shown if card is selected */}
              {selectionEnabled && isSelected && (
                <div
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-lg">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(printing.printing_id, Math.max(1, quantity - 1));
                        }}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <Minus className="w-3.5 h-3.5 text-white" />
                      </button>
                      <div className="text-center text-sm font-bold text-white min-w-[20px]">
                        {quantity}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(printing.printing_id, quantity + 1);
                        }}
                        aria-label="Increase quantity"
                        className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price section - below the card image */}
            {(printing.tcg_low !== undefined && printing.tcg_low !== null) && (
              <div className="mt-1.5 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-1.5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    ${printing.tcg_low.toFixed(2)}
                  </span>
                  {printing.tcgplayer_url && (
                    <TcgAffiliateLink
                      tcgplayerUrl={printing.tcgplayer_url}
                      feature="SearchResultsImageClick"
                      className="hover:opacity-80 transition-opacity"
                      title="Purchase on TCGPlayer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                        alt="TCGPlayer"
                        className="h-4 w-auto"
                      />
                    </TcgAffiliateLink>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Calm card preview - large image, backdrop/Esc/✕ to close, no flip */}
    {previewPrinting && (
      <div
        data-testid="preview-backdrop"
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={() => setPreviewPrinting(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewPrinting.display_name || previewPrinting.name}
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreviewPrinting(null)}
            className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-gray-900 border border-gray-600 text-gray-300 hover:text-white flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="h-[min(85vh,126vw)] aspect-[2.5/3.5]">
            {previewPrinting.image_url ? (
              <FoilCardImage
                foiling={previewPrinting.foiling}
                artStyle={artStylesFromPrinting(previewPrinting.art_variations, previewPrinting.is_extended_art)}
                foilInset={foilInsetFromValues(previewPrinting.foil_inset_top, previewPrinting.foil_inset_right, previewPrinting.foil_inset_bottom, previewPrinting.foil_inset_left, previewPrinting.foil_inset_round)}
                src={previewPrinting.image_url}
                alt={previewPrinting.display_name || previewPrinting.name}
                className="w-full h-full"
                imgClassName="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 rounded-xl flex items-center justify-center">
                <span className="text-gray-400 text-lg text-center px-4">
                  {previewPrinting.display_name || previewPrinting.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

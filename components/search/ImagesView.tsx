import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { TcgAffiliateLink } from '@/components/tracking';
import { FOILING_STYLES, EDITION_MAP } from '@/lib/fab-constants';
import { Minus, Plus } from 'lucide-react';
import FoilCardImage from '@/components/shared/FoilCardImage';

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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">


      {printings.map((printing: any) => {
  console.log('--- PRINTING START ---');
  console.log(JSON.stringify(printing, null, 2)); // Prettify the JSON
  console.log('--- PRINTING END ---');

        console.log('DEBUG printing:', printing)
        
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

                {/* Right: Edition and Foiling */}
                <div className="flex items-center gap-1.5">
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
                className={`relative aspect-[2.5/3.5] rounded-lg overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                  {printing.image_url ? (
                    
                    <FoilCardImage
                      foiling={printing.foiling}
                      artStyle={[
                        printing.is_extended_art && 'extended-art',
                        (printing.art_variations?.includes('AA') || printing.art_variations?.includes('AB')) && 'alternate-art',
                        printing.art_variations?.includes('AB') && 'alternate-border',
                        printing.art_variations?.includes('FA') && 'full-art',
                      ].filter((s): s is string => Boolean(s))}
                      foilInset={printing.foil_inset_bottom != null ? {
                        top: printing.foil_inset_top,
                        right: printing.foil_inset_right,
                        bottom: printing.foil_inset_bottom,
                        left: printing.foil_inset_left,
                        round: printing.foil_inset_round,
                      } : null}
                      src={printing.image_url}
                      alt={printing.display_name || printing.name}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      expandable
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500 text-sm text-center px-2">
                        {printing.display_name || printing.name}
                      </span>
                    </div>
                  )}
                </div>

              {/* Checkbox overlay - centered vertically and horizontally */}
              {selectionEnabled && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="bg-white dark:bg-gray-800 rounded-md p-2 shadow-lg border-2 border-gray-300 dark:border-gray-600">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(printing)}
                      className="w-6 h-6"
                    />
                  </div>
                </div>
              )}

              {/* Quantity selector - only shown if card is selected */}
              {selectionEnabled && isSelected && (
                <div
                  className="absolute top-10 right-2 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                    <div className="text-[10px] text-white/80 font-medium mb-1 text-center">Qty</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(printing.printing_id, Math.max(1, quantity - 1));
                        }}
                        disabled={quantity <= 1}
                        className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-md"
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
                        className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-md"
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
  );
}

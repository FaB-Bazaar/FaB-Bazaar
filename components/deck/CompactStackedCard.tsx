// components/deck/CompactStackedCard.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { RarityIcon } from "@/components/shared/RarityIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Heart, BookOpen, Trash2, Plus } from "lucide-react";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
}

interface CompactStackedCardProps {
  printing: DeckPrinting & { category: string };
  showFullDetails?: boolean;
  isHovered?: boolean;
  ownership?: any;
  onSwapPrinting?: (printing: DeckPrinting & { category: string }) => void;
  onAddToWants?: (printing: DeckPrinting & { category: string }) => void;
  onAddToBinder?: (printing: DeckPrinting & { category: string }) => void;
  onMove?: (printing: DeckPrinting & { category: string }) => void;
  onRemove?: (printing: DeckPrinting & { category: string }) => void;
  onAddAnother?: (printing: DeckPrinting & { category: string }) => void;
  wantsInfo?: { wanted: number; inDeck: number };
  binderInfo?: { owned: number; inDeck: number };
  editable?: boolean;
}

// Helper functions for display
function getEditionDisplayName(edition: string): string {
  const editionMap: { [key: string]: string } = {
    'f': '1st',
    'F': '1st',
    'u': 'UNL',
    'U': 'UNL',
    'n': 'Normal',
    'N': 'Normal',
  };
  return editionMap[edition] || edition;
}

function getFoilingColor(foiling: string): string {
  const foilingColors: { [key: string]: string } = {
    'R': 'bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500', // Rainbow
    'C': 'bg-gradient-to-r from-blue-400 to-cyan-300', // Cold
    'G': 'bg-gradient-to-r from-yellow-500 to-amber-400', // Gold
    'S': 'bg-gray-500', // Non-foil
  };
  return foilingColors[foiling?.toUpperCase()] || 'bg-gray-500';
}

function getFoilingDisplayName(foiling: string): string {
  const foilingNames: { [key: string]: string } = {
    'R': 'RF', // Rainbow Foil
    'C': 'CF', // Cold Foil
    'G': 'GF', // Gold Foil
    'S': 'NF', // Non-foil
  };
  return foilingNames[foiling?.toUpperCase()] || 'NF';
}

function getFoilingFullName(foiling: string): string {
  const foilingNames: { [key: string]: string } = {
    'R': 'Rainbow Foil',
    'C': 'Cold Foil',
    'G': 'Gold Foil',
    'S': 'Non-Foil',
  };
  return foilingNames[foiling?.toUpperCase()] || 'Non-Foil';
}

function getSetColor(setId: string): string {
  // Using tailwind border colors for set identification
  const setColors: { [key: string]: string } = {
    'WTR': 'border-red-500',
    'ARC': 'border-blue-500',
    'CRU': 'border-purple-500',
    'MON': 'border-green-500',
    'ELE': 'border-yellow-500',
    'EVR': 'border-pink-500',
    'UPR': 'border-orange-500',
    'DYN': 'border-cyan-500',
  };
  return setColors[setId] || 'border-gray-500';
}

export default function CompactStackedCard({
  printing,
  showFullDetails = false,
  isHovered = false,
  ownership,
  onSwapPrinting,
  onAddToWants,
  onAddToBinder,
  onMove,
  onRemove,
  onAddAnother,
  wantsInfo,
  binderInfo,
  editable
}: CompactStackedCardProps) {
  const details = printing.printingDetails || {};
  const allDetails = (details as any).allDetails || details;
  const edition = allDetails.edition || 'N';
  const foiling = allDetails.foiling || 'S';
  const setId = allDetails.set || allDetails.set_id || '';
  const rarity = details.rarity || 'C';
  const imageUrl = details.image_url || details.image_uris?.front || '/placeholder-card.png';
  const cardName = details.display_name || details.name || 'Unknown Card';
  const setName = (allDetails.set || allDetails.set_id || 'Unknown Set').toUpperCase();
  const condition = printing.condition || 'NM';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              relative rounded-lg overflow-hidden shadow-lg
              transition-all duration-300 ease-out
              ${isHovered ? 'shadow-2xl' : 'shadow-lg'}
              ${getSetColor(setId)} border-2
            `}
            style={{
              width: '140px',
              height: '196px',
            }}
          >
            {/* Card Image */}
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={cardName}
                fill
                className="object-cover"
                sizes="140px"
                unoptimized
              />

              {/* Overlay gradient for better badge visibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30" />

              {/* Top-left: Foiling Badge - Clickable to swap printing */}
              <div className="absolute top-1 left-1 flex flex-col gap-1">
                <div
                  className={`px-2 py-0.5 rounded-md text-[9px] font-semibold flex items-center gap-1 shadow-sm ${getFoilingColor(foiling)} ${
                    onSwapPrinting ? 'cursor-pointer hover:scale-110 hover:shadow-lg transition-all' : ''
                  }`}
                  onClick={(e) => {
                    if (onSwapPrinting) {
                      e.stopPropagation();
                      onSwapPrinting(printing);
                    }
                  }}
                  title={onSwapPrinting ? `Click to change printing (${getFoilingFullName(foiling)})` : getFoilingFullName(foiling)}
                >
                  <span className="text-white drop-shadow-sm">
                    {getFoilingDisplayName(foiling)}
                  </span>
                </div>
                {/* Edition Badge - below foiling */}
                <Badge className="text-[8px] px-1 py-0 bg-black/80 text-white border-white/30">
                  {getEditionDisplayName(edition)}
                </Badge>
              </div>

              {/* Bottom-right: Rarity Icon */}
              <div className="absolute bottom-1 right-1">
                <RarityIcon rarityCode={rarity} size="sm" />
              </div>

              {/* Bottom-left: Ownership and Condition indicators */}
              <div className="absolute bottom-1 left-1 flex flex-col gap-0.5">
                {/* Ownership indicator */}
                {ownership && (
                  <div className="flex items-center">
                    {ownership.owned >= ownership.needed ? (
                      <div className="bg-green-600/90 rounded-full p-0.5" title="You own this version">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    ) : ownership.owned > 0 ? (
                      <div className="bg-yellow-600/90 rounded-full p-0.5" title={`Partial (${ownership.owned}/${ownership.needed})`}>
                        <AlertCircle className="h-3 w-3 text-white" />
                      </div>
                    ) : ownership.alternative && ownership.alternative > 0 ? (
                      <div className="bg-blue-600/90 rounded-full p-0.5" title="You own other versions">
                        <RefreshCw className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="bg-red-600/90 rounded-full p-0.5" title="Do not own">
                        <XCircle className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                )}

                {/* Condition badge if not NM */}
                {condition !== 'NM' && (
                  <Badge className="text-[8px] px-1 py-0 bg-black/80 text-white border-white/30">
                    {condition}
                  </Badge>
                )}
              </div>

              {/* Action Buttons Overlay - Only show when hovered and editable */}
              {editable && isHovered && (
                <>
                  {/* Top-right buttons (vertical stack) */}
                  <div className="absolute top-0 right-0 flex flex-col gap-1 p-1">
                    {/* Add to Wants Button */}
                    {onAddToWants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToWants(printing);
                        }}
                        className={`h-8 w-8 flex items-center justify-center rounded ${
                          wantsInfo && wantsInfo.wanted > 0 ? 'bg-pink-600' : 'bg-gray-900/80 hover:bg-pink-600'
                        } text-white shadow-lg transition-colors`}
                        title={wantsInfo && wantsInfo.wanted > 0 ? `Want ${wantsInfo.wanted} of ${wantsInfo.inDeck}` : 'Add to wants'}
                      >
                        <Heart className="h-5 w-5" />
                      </button>
                    )}

                    {/* Add to Binder Button */}
                    {onAddToBinder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToBinder(printing);
                        }}
                        className={`h-8 w-8 flex items-center justify-center rounded ${
                          binderInfo && binderInfo.owned > 0 ? 'bg-blue-600' : 'bg-gray-900/80 hover:bg-blue-600'
                        } text-white shadow-lg transition-colors`}
                        title={binderInfo && binderInfo.owned > 0 ? `Have ${binderInfo.owned} in binder` : 'Add to binder'}
                      >
                        <BookOpen className="h-5 w-5" />
                      </button>
                    )}

                    {/* Swap Printing Button */}
                    {onSwapPrinting && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapPrinting(printing);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded bg-gray-900/80 hover:bg-purple-600 text-white shadow-lg transition-colors"
                        title="Swap printing"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </button>
                    )}

                    {/* Move Button */}
                    {onMove && printing.category !== 'hero' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(printing);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded bg-gray-900/80 hover:bg-green-600 text-white shadow-lg transition-colors text-[10px] font-bold"
                        title={printing.category === 'maindeck' ? 'Move to inventory' : printing.category === 'inventory' ? 'Move to maindeck' : 'Move to equipment'}
                      >
                        {printing.category === 'maindeck' ? 'INV' : printing.category === 'inventory' ? 'MAIN' : 'EQP'}
                      </button>
                    )}
                  </div>

                  {/* Bottom-right buttons (horizontal row) */}
                  <div className="absolute bottom-1 right-1 flex flex-row gap-1">
                    {/* Add Another Copy Button */}
                    {onAddAnother && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddAnother(printing);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded bg-gray-900/80 hover:bg-green-600 text-white shadow-lg transition-colors"
                        title="Add another copy"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}

                    {/* Delete Button */}
                    {onRemove && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(printing);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded bg-gray-900/80 hover:bg-red-600 text-white shadow-lg transition-colors"
                        title="Remove from deck"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </TooltipTrigger>

        {/* Tooltip with full details */}
        {showFullDetails && (
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">{cardName}</div>
              <div className="text-gray-400">
                {setName} • {getEditionDisplayName(edition)}
              </div>
              <div className="flex items-center gap-2">
                <span>{getFoilingFullName(foiling)}</span>
                <span>•</span>
                <span>{condition}</span>
              </div>
              {printing.notes && (
                <div className="text-gray-400 italic">
                  Note: {printing.notes}
                </div>
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

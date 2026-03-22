// components/binder/BinderHeader.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCircle, Download, ArrowLeft, BookOpen, Copy, Check, Keyboard } from 'lucide-react';

import { PricingStatus } from './PricingStatus';
import { profileHref } from '@/lib/utils/display-username';

interface BinderHeaderProps {
  binder: any;
  stats: {
    totalCards: number;
    forTradeCount: number;
    estimatedValue: number;
  };
  editable: boolean;
  selectedCards: any[];
  onAddCard: () => void;
  onOpenSidebar: () => void;
  onExportList?: () => void;
  cardsCount?: number;
  priceUpdatedAt?: Date | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const BinderHeader: React.FC<BinderHeaderProps> = ({
  binder,
  stats,
  editable,
  selectedCards,
  onAddCard,
  onOpenSidebar,
  onExportList,
  cardsCount = 0,
  priceUpdatedAt
}) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac'));
  }, []);

  const modKey = isMac ? '⌘' : 'Ctrl';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className="mb-3 sm:mb-6">
      {binder?.username && (
        <div className="mb-2 sm:mb-4 flex gap-1.5 sm:gap-2">
          {/* Show "My Collection" button only if user is the owner */}
          {editable && (
            <Link
              href="/collection"
              className="inline-flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 rounded-lg border border-purple-200 dark:border-purple-700 transition-all duration-200 group flex-1 sm:flex-initial justify-center"
            >
              <ArrowLeft className="hidden sm:block h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              <BookOpen className="hidden sm:block h-4 w-4" />
              <span className="font-medium">My Collection</span>
            </Link>
          )}

          {/* Profile button - always shown for everyone */}
          <Link
            href={profileHref(binder.username)}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-700 transition-all duration-200 group flex-1 sm:flex-initial justify-center"
          >
            <UserCircle className="hidden sm:block h-4 w-4" />
            <span className="truncate">
              <span className="font-medium">
                {binder.discordUsername || binder.username}
              </span>
              <span className="text-blue-600 dark:text-blue-400 ml-1">'s Profile</span>
            </span>
          </Link>
        </div>
      )}

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-4">
        {binder?.name || "Trade Binder"}
      </h1>

      <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4 flex-wrap text-xs sm:text-sm">
        <Badge className={binder?.isPublic ? "bg-green-500 text-white" : "bg-gray-500 text-white"}>
          {binder?.isPublic ? "Public" : "Private"}
        </Badge>

        {/* --- MODIFIED TO USE STATS PROP DIRECTLY --- */}
        <span className="text-gray-600 dark:text-gray-400">
          {stats.totalCards} cards • {stats.forTradeCount} for trade
        </span>

        {stats.estimatedValue > 0 && (
          <span className="text-green-600 dark:text-green-400 font-semibold">
            {formatCurrency(stats.estimatedValue)} (TCG Low)
          </span>
        )}
        <PricingStatus lastUpdatedAt={priceUpdatedAt} />
      </div>

      <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
      {editable && (
          <>
            <Button
              onClick={onAddCard}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-initial"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Add Cards
            </Button>

            {selectedCards.length > 0 && (
              <Button
                variant="outline"
                onClick={onOpenSidebar}
                className="border-blue-200 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
              >
                {selectedCards.length} Selected
              </Button>
            )}
          </>
        )}
        {(stats.totalCards > 0 || cardsCount > 0) && onExportList && (
          <Button
            variant="outline"
            onClick={onExportList}
            className="border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-initial"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            Export
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleCopyLink}
          className="border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-initial"
        >
          {linkCopied ? (
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          )}
          {linkCopied ? 'Copied!' : 'Copy Link'}
        </Button>

        {/* Keyboard shortcut guide — desktop only */}
        <div className="relative hidden sm:block">
          <Button
            variant="outline"
            onClick={() => setShortcutGuideOpen(v => !v)}
            className={`h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 font-medium transition-colors ${
              shortcutGuideOpen
                ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-400 dark:border-violet-500 text-violet-700 dark:text-violet-300'
                : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-700 dark:hover:text-violet-300'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            <span className="font-mono">{modKey}K</span>
          </Button>
          {shortcutGuideOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShortcutGuideOpen(false)} />
              <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Keyboard Shortcuts</p>
                <div className="space-y-2.5">
                  {[
                    { keys: `${modKey}K → letter`, desc: 'Filter by starting letter (A–Z)' },
                    { keys: `${modKey}K → 1 → key`, desc: 'Rarity — F=Fabled V=Marvel L=Legendary M=Majestic P=Promo S=Super Rare R=Rare C=Common B=Basic T=Token' },
                    { keys: `${modKey}K → 2 → key`, desc: 'Foiling — R=Rainbow C=Cold G=Gold S=Non-foil' },
                    { keys: `${modKey}K → 3 → code`, desc: <>Set by code (e.g. <span className="font-mono text-violet-600 dark:text-violet-400">cru</span>, <span className="font-mono text-violet-600 dark:text-violet-400">mst</span>)</> },
                    { keys: `${modKey}K → 4 → name`, desc: <>Class (e.g. <span className="font-mono text-violet-600 dark:text-violet-400">ninja</span>, <span className="font-mono text-violet-600 dark:text-violet-400">generic</span>)</> },
                    { keys: `${modKey}K → 9`, desc: 'Open Add Card dialog' },
                    { keys: `${modKey}K → 0 → 0`, desc: 'Clear all filters' },
                    { keys: 'Esc', desc: 'Cancel shortcut' },
                  ].map(({ keys, desc }) => (
                    <div key={keys} className="flex items-start gap-3">
                      <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono text-xs border border-gray-300 dark:border-gray-600 whitespace-nowrap">{keys}</kbd>
                      <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
// // components/binder/BinderHeader.tsx
// "use client";

// import React from 'react';
// import Link from 'next/link'; 
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Plus, UserCircle, ArrowRightLeft, Lock, Download } from 'lucide-react';

// import { PricingStatus } from './PricingStatus';

// // --- UPDATED INTERFACE ---
// interface BinderHeaderProps {
//   binder: any;
//   stats: {
//     totalCards: number;
//     forTradeCount: number;
//     uniqueCards: number;
//     estimatedValue: number;
//     totalQuantity: number;
//   };
//   editable: boolean;
//   selectedCards: any[];
//   onAddCard: () => void;
//   onBulkUpdateForTrade: (forTrade: boolean) => void;
//   onOpenSidebar: () => void;
//   onExportList?: () => void;
// }

// function formatCurrency(value: number): string {
//   return new Intl.NumberFormat('en-US', {
//     style: 'currency',
//     currency: 'USD',
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(value);
// }

// export const BinderHeader: React.FC<BinderHeaderProps> = ({
//   binder,
//   stats,
//   editable,
//   selectedCards,
//   onAddCard,
//   onBulkUpdateForTrade,
//   onOpenSidebar,
//   onExportList
// }) => {
//   // Extract data from the new binder structure with fallbacks
//   const totalCards = binder?.totalQuantity || stats?.totalCards || 0;
  
//   const forTradeCount = binder?.quantityForTrade || stats?.forTradeCount || 0;
  
//   const totalValue = binder?.totalValue?.tcg_low || 
//                    stats?.estimatedValue || 0;

//   return (
//     <div className="mb-6">
//       {binder?.username && (
//         <div className="mb-2">
//           <Link 
//             href={profileHref(binder.username)} 
//             className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
//           >
//             <UserCircle className="h-4 w-4" />
//             <span>
//               Owned by{' '} 
//               <span className="font-semibold text-foreground group-hover:text-primary">
//                 {binder.discordUsername || binder.username}
//               </span>
//             </span>
//           </Link>
//         </div>
//       )}

//       <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
//         {binder?.name || "Trade Binder"}
//       </h1>
      
//       <div className="flex items-center gap-4 mb-4 flex-wrap">
//         <Badge className={binder?.isPublic ? "bg-green-500 text-white" : "bg-gray-500 text-white"}>
//           {binder?.isPublic ? "Public Binder" : "Private Binder"}
//         </Badge>
        
//         <span className="text-gray-600 dark:text-gray-400">
//           {totalCards} cards • {forTradeCount} for trade
//         </span>

//         {totalValue > 0 && (
//           <span className="text-green-600 dark:text-green-400 font-semibold">
//             {formatCurrency(totalValue)} (TCG Low)
//           </span>
//         )}
//         <PricingStatus />
//       </div>

//       <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
//       {editable && (
//           <>
//             <Button 
//               onClick={onAddCard}
//               className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
//             >
//               <Plus className="h-4 w-4 mr-2" />
//               Add Cards
//             </Button>
            
//             {totalCards > 0 && (
//               <div className="flex items-center gap-2">
//                 <span className="text-sm font-medium text-gray-600 dark:text-gray-400 sm:hidden">
//                   Set Trade:
//                 </span>

//                 <div className="flex gap-1 border border-gray-200 dark:border-gray-600 rounded-lg p-1 bg-gray-50 dark:bg-gray-800">
//                   <Button
//                     variant={forTradeCount === totalCards ? "default" : "ghost"}
//                     onClick={() => onBulkUpdateForTrade(true)}
//                     disabled={forTradeCount === totalCards}
//                     className="h-9 px-3"
//                     title="Mark all cards as FOR TRADE"
//                   >
//                     <ArrowRightLeft className="h-4 w-4" />
//                     <span className="hidden sm:inline sm:ml-2 text-xs">For Trade</span>
//                   </Button>
                  
//                   <Button
//                     variant={forTradeCount === 0 ? "default" : "ghost"}
//                     onClick={() => onBulkUpdateForTrade(false)}
//                     disabled={forTradeCount === 0}
//                     className="h-9 px-3"
//                     title="Mark all cards as NOT FOR TRADE"
//                   >
//                     <Lock className="h-4 w-4" />
//                     <span className="hidden sm:inline sm:ml-2 text-xs">Not For Trade</span>
//                   </Button>
//                 </div>
//               </div>
//             )}

//             {selectedCards.length > 0 && (
//               <Button 
//                 variant="outline"
//                 onClick={onOpenSidebar}
//                 className="border-blue-200 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900"
//               >
//                 {selectedCards.length} Selected
//               </Button>
//             )}
//           </>
//         )}
//         {totalCards > 0 && onExportList && (
//           <Button 
//             variant="outline"
//             onClick={onExportList}
//             className="border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
//           >
//             <Download className="h-4 w-4 mr-2" />
//             Export
//           </Button>
//         )}
//       </div>
//     </div>
//   );
// };
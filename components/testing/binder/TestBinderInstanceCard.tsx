"use client"

import React from "react"
import { Switch } from "@/components/ui/switch"
import { RarityIcon } from '@/components/shared/RarityIcon'
import { Minus, Plus, Edit3, Trash2, ExternalLink } from "lucide-react"

interface TestBinderInstanceCardProps {
  instance: any;
}

export default function TestBinderInstanceCard({ instance }: TestBinderInstanceCardProps) {
  if (!instance) {
    return (
      <div className="w-[240px] h-[400px] rounded-lg bg-[#212734] border border-red-500 p-4">
        <p className="text-red-400">Error: Invalid card data.</p>
      </div>
    );
  }

  const getFoilingInfo = (foiling?: string | null) => {
    const code = (foiling || '').toUpperCase();
    const foilingMap = {
      'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
      'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
      'S': { name: 'Non-foil', className: 'bg-gray-700 text-white' }
    };
    return foilingMap[code] || { name: 'Foil', className: 'bg-gray-700 text-white' };
  };

  const renderPriceLine = (label: string, price: number | undefined) => {
    if (price === undefined || price === null) return null;
    const isLow = label.toLowerCase() === 'low';
    return (
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400">{label}:</span>
        <span className={isLow ? "text-green-400 font-semibold" : "text-gray-200"}>
          ${price.toFixed(2)}
          {isLow && instance.tcgplayer_url && (
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(instance.tcgplayer_url, '_blank', 'noopener,noreferrer');
                }}
                className="inline-block ml-1 p-1 hover:bg-gray-700 rounded transition-colors align-middle"
                title="View on TCGPlayer"
              >
                <ExternalLink className="w-3 h-3 text-blue-400" />
              </button>
          )}
        </span>
      </div>
    );
  };

  const foilingInfo = getFoilingInfo(instance.foiling);
  const hasPriceData = instance.tcgMarket || instance.tcgLow;

  return (
    // The main container is now a flex column to enable anchoring
    <div className="w-[240px] rounded-lg bg-[#212734] border border-gray-700 shadow-lg flex flex-col">
      {/* 
        This is the new Image Section. 
        It's now separate from the info, just like your other component.
      */}
      <div className="relative w-full h-[335px] bg-gray-800 flex items-center justify-center rounded-t-lg">
        <img
          src={instance.image_url || "/cardback.webp"}
          alt={instance.displayName}
          className="max-w-full max-h-full object-contain"
          loading="lazy"
        />
        {instance.condition && instance.condition !== 'NM' && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
            {instance.condition}
          </div>
        )}
      </div>

      {/* This is the main info container, using flex-grow to push footer down */}
      <div className="p-3 flex-grow flex flex-col space-y-3">
        {/* Top Info Block */}
        <div>
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg text-white leading-tight">{instance.displayName}</h3>
            {instance.forTrade && <span className="text-green-400 font-semibold text-sm">For Trade</span>}
          </div>
          <p className="text-sm text-gray-400">{instance.setName?.toUpperCase()}</p>
          <p className="text-sm text-gray-400 truncate">{instance.type_text}</p>
        </div>

        {/* Price Block - only renders if there's data */}
        {hasPriceData && (
          <div className="space-y-1">
            {renderPriceLine("Market", instance.tcgMarket)}
            {renderPriceLine("Low", instance.tcgLow)}
          </div>
        )}
        
        {/* This spacer div is the key to anchoring the elements below */}
        <div className="flex-grow" />

        {/* --- ANCHORED BOTTOM SECTION --- */}
        <div className="space-y-3">
          {/* Rarity and Foiling */}
          <div className="flex items-center gap-2">
            {instance.rarity && <RarityIcon rarityCode={instance.rarity} size="sm" />}
            <div className={`text-sm rounded-full px-3 py-1 w-full text-center ${foilingInfo.className}`}>
              {foilingInfo.name}
            </div>
          </div>
          
          {/* For Trade Toggle */}
          <div className={`flex items-center gap-3 rounded-full p-1.5 transition-colors ${instance.forTrade ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
            <Switch
              checked={!!instance.forTrade}
              onCheckedChange={(checked) => console.log(`Toggle 'For Trade' for ${instance._id} to ${checked}`)}
            />
            <span className={`font-medium text-sm ${instance.forTrade ? 'text-green-400' : 'text-gray-400'}`}>
              For Trade
            </span>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500 flex items-center justify-center disabled:opacity-50" disabled>
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-lg">1</span>
              <button className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500 flex items-center justify-center disabled:opacity-50" disabled>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <button onClick={() => console.log(`External link clicked`)} className="p-1 hover:text-white"><ExternalLink className="w-5 h-5"/></button>
              <button onClick={() => console.log(`Edit clicked`)} className="p-1 hover:text-white"><Edit3 className="w-5 h-5"/></button>
              <button onClick={() => console.log(`Remove clicked`)} className="p-1 text-red-500 hover:text-red-400"><Trash2 className="w-5 h-5"/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// "use client"

// import React from "react"
// import { Badge } from "@/components/ui/badge"
// import { RarityIcon } from '@/components/shared/RarityIcon' // Assuming you have this component

// // This component displays a SINGLE physical card instance.
// // It expects a prop 'instance' that has been enriched with its parent group's data.
// interface TestBinderInstanceCardProps {
//   instance: any; // e.g., { _id, condition, notes, initialTcgLowPrice, displayName, setName, rarity, ... }
// }

// export default function TestBinderInstanceCard({ instance }: TestBinderInstanceCardProps) {

//   const getFoilingInfo = (foiling: string) => {
//     const foilingMap = {
//       'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
//       'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
//       'G': { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
//       'S': { name: 'Non-foil', className: 'bg-gray-500 text-white' }
//     }
//     const code = foiling?.toUpperCase();
//     return foilingMap[code] || { name: 'Non-foil', className: 'bg-gray-500 text-white' };
//   }

//   const foilingInfo = getFoilingInfo(instance.foiling);

//   return (
//     <div className="w-[200px] rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex-shrink-0 flex flex-col">
//       {/* Image Section */}
//       <div className="relative w-full h-[280px] bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
//         <img
//           src={instance.image_url || "/cardback.webp"} // Assuming image_url is on the group
//           alt={instance.displayName}
//           className="max-w-full max-h-full object-contain rounded-t-lg"
//           loading="lazy"
//         />
//         {instance.condition && instance.condition !== 'NM' && (
//           <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
//             {instance.condition}
//           </div>
//         )}
//       </div>

//       {/* Info Section */}
//       <div className="p-3 flex-1 flex flex-col justify-between">
//         <div>
//           <h4 className="font-semibold text-sm leading-tight truncate">{instance.displayName}</h4>
//           <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
//             <span className="font-mono uppercase">{instance.setName}</span>
//             {instance.rarity && <RarityIcon rarityCode={instance.rarity} size="sm" />}
//           </div>
//         </div>

//         <div className="mt-2 space-y-2">
//           {instance.notes && (
//             <p className="text-xs text-gray-600 dark:text-gray-400 italic truncate" title={instance.notes}>
//               "{instance.notes}"
//             </p>
//           )}

//           <div className="text-xs">
//             <div className="flex justify-between">
//               <span className="text-gray-500">Acquired at:</span>
//               <span className="font-semibold text-green-600 dark:text-green-400">
//                 ${instance.initialTcgLowPrice?.toFixed(2)}
//               </span>
//             </div>
//             <div className="flex justify-between">
//               <span className="text-gray-500">Market:</span>
//               <span className="font-semibold">
//                 ${instance.tcgMarket?.toFixed(2) ?? 'N/A'}
//               </span>
//             </div>
//           </div>
          
//           <Badge className={`w-full justify-center ${foilingInfo.className}`}>
//             {foilingInfo.name}
//           </Badge>
//         </div>
//       </div>
//     </div>
//   )
// }
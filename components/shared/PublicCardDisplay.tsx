// components/PublicCardDisplay.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { Layers } from "lucide-react";
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import { getSetName, getRarityName, getFoilingName, getEditionName } from "@/lib/fab-formatters";

interface PublicCardDisplayProps {
  card: any; 
  onPrintingView: (card: any) => void;
}

export default function PublicCardDisplay({ card, onPrintingView }: PublicCardDisplayProps) {
  const name = card.display_name || card.name;
  const printingId = card.printing_id || card.printingId;
  const imageUrl = card.image_url || card.printingDetails?.image_url;
  const rarity = card.rarity || card.printingDetails?.rarity;
  const foiling = card.foiling || card.printingDetails?.foiling;

  return (
    <div className="w-full rounded-lg overflow-hidden bg-card border border-border transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col group">
      <Link href={`/printing/${printingId}`} className="block">
        <div className="relative aspect-[63/88] w-full bg-muted">
          <img
            src={imageUrl || "/cardback.webp"}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
          />
        </div>
      </Link>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-tight mb-2 truncate" title={name}>
          {name}
        </h3>
        <div className="flex-1"></div>
        <div className="flex items-center gap-2 mt-2">
          {rarity && <RarityIcon rarityCode={rarity} size="sm" />}
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 justify-center text-xs h-auto py-0.5"
            onClick={() => onPrintingView(card)}
          >
            {getFoilingName(foiling)}
            <Layers className="w-3 h-3 ml-1.5" />
          </Button>
        </div>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
          <span className="text-lg font-bold text-green-400">
            {card.tcg_low ? `$${card.tcg_low.toFixed(2)}` : ''}
          </span>
          <WhoHasDropdown printingId={printingId} cardName={name} />
        </div>
      </div>
    </div>
  );
}

// // components/PublicCardDisplay.tsx
// "use client";

// import React from "react";
// import Link from "next/link";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { RarityIcon } from '@/components/shared/RarityIcon';
// import { cn } from '@/lib/utils';
// import { ExternalLink, Layers } from "lucide-react";
// import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
// import { getSetName, getRarityName, getFoilingName, getEditionName } from "@/lib/fab-formatters";

// // Define the shape of the card data this component expects
// interface PublicCardDisplayProps {
//   card: any; 
//   // --- ADD THIS PROP ---
//   // A function to call when the user wants to view other printings
//   onPrintingView: (card: any) => void;
// }

// export default function PublicCardDisplay({ card, onPrintingView }: PublicCardDisplayProps) {

//   // Data Normalization (unchanged)
//   const name = card.display_name || card.name;
//   const printingId = card.printing_id || card.printingId;
//   const imageUrl = card.image_url || card.printingDetails?.image_url;
//   const set = card.set || card.printingDetails?.set_id;
//   const rarity = card.rarity || card.printingDetails?.rarity;
//   const foiling = card.foiling || card.printingDetails?.foiling;
//   const edition = card.edition || card.printingDetails?.edition;
//   const typeText = card.type_text || card.printingDetails?.type_text;
//   const tcgPlayerUrl = card.tcgplayer_url || card.printingDetails?.tcgplayer_url;
  
//   const prices = {
//     low: card.tcg_low ?? card.printingDetails?.tcg_low,
//     mid: card.tcg_mid ?? card.printingDetails?.tcg_mid,
//     high: card.tcg_high ?? card.printingDetails?.tcg_high,
//     market: card.tcg_market ?? card.printingDetails?.tcg_market,
//   };

//   const renderPriceLine = (price: number | undefined, label: string, isLow = false) => {
//     if (price == null) return null;
//     return (
//       <div className={`flex justify-between items-center text-xs ${isLow ? 'font-semibold text-green-500' : 'text-muted-foreground'}`}>
//         <span>{label}</span>
//         <span>${Number(price).toFixed(2)}</span>
//       </div>
//     );
//   };

//   return (
//     <div className={cn("w-full rounded-lg ...")}>
//       {/* ... Image Section is unchanged ... */}
      
//       <div className="p-3 flex-1 flex flex-col">
//         {/* ... Name, Set, Type, Prices sections are unchanged ... */}
        
//         {/* Rarity & Foiling Badges */}
//         <div className="flex items-center gap-2 mt-2">
//           {rarity && <RarityIcon rarityCode={rarity} size="sm" />}
          
//           {/* --- THIS IS THE FIX --- */}
//           {/* This is now a clickable button that triggers the onPrintingView prop */}
//           <Button
//             variant="secondary"
//             size="sm"
//             className="flex-1 justify-center text-xs h-auto py-0.5"
//             onClick={() => onPrintingView(card)}
//           >
//             {getFoilingName(foiling)}
//             <Layers className="w-3 h-3 ml-1.5" />
//           </Button>
//         </div>

//         {/* Action Buttons */}
//         <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
//           <Button variant="ghost" size="sm" asChild>
//             <Link href={tcgPlayerUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-xs">
//               TCGplayer <ExternalLink className="w-3 h-3 ml-1" />
//             </Link>
//           </Button>
//           <WhoHasDropdown printingId={printingId} cardName={name} />
//         </div>
//       </div>
//     </div>
//   );
// }
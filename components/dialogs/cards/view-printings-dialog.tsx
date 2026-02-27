//components/ViewPrintingsDialog.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetName, getFoilingName, getEditionName, getVariantBadgeStyles } from "@/lib/fab-formatters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TcgAffiliateLink } from '@/components/tracking';

// Custom Sorting Logic - this remains the same
const sortPrintings = (printings: any[]) => {
  const editionOrder: Record<string, number> = { 'a': 0, 'f': 1, 'u': 2, 'n': 3 };
  const variantOrder: Record<string, number> = { 'v': 0, 'ea': 1, 'c': 2, 'r': 3, 's': 4 };
  const getVariantSortKey = (p: any): number => {
    if (p.rarity === 'v') return variantOrder['v'];
    if (p.is_extended_art) return variantOrder['ea'];
    return variantOrder[p.foiling] ?? 99;
  };
  return [...printings].sort((a, b) => {
    const setNameA = getSetName(a.set);
    const setNameB = getSetName(b.set);
    if (setNameA < setNameB) return -1;
    if (setNameA > setNameB) return 1;
    const editionA = editionOrder[a.edition] ?? 99;
    const editionB = editionOrder[b.edition] ?? 99;
    if (editionA !== editionB) return editionA - editionB;
    const variantA = getVariantSortKey(a);
    const variantB = getVariantSortKey(b);
    return variantA - variantB;
  });
};

export default function ViewPrintingsDialog({ 
  open, onOpenChange, cardName, cardUniqueId, onSelectPrinting 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  cardUniqueId: string;
  onSelectPrinting: (printing: any) => void; 
}) {
  const [printings, setPrintings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && cardUniqueId) {
      const fetchPrintings = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/printings/search?cardUniqueId=${cardUniqueId}&limit=50&show=browse_bulk`);
          const data = await response.json();
          if (data.success && data.data?.printings) {
            const sorted = sortPrintings(data.data.printings);
            setPrintings(sorted);
          } else { throw new Error('Could not find other printings.'); }
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load printings');
        } finally { setLoading(false); }
      };
      fetchPrintings();
    }
  }, [open, cardUniqueId]);

  const handlePrintingClick = (printing: any) => {
    onSelectPrinting(printing);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Available Printings: {cardName}</DialogTitle>
          <DialogDescription>
            Click on a printing to update the card display, or click the price to purchase on TCGPlayer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : error ? (
            <p className="text-red-400 text-center py-8">{error}</p>
          ) : (
            printings.map((p, index) => {
              const showSetHeader = index === 0 || p.set !== printings[index - 1].set;
              
              return (
                <React.Fragment key={p.printing_id}>
                  {showSetHeader && (
                    <div className="font-bold text-lg pt-4 pb-1 border-b border-gray-700 text-gray-200">
                      {getSetName(p.set)}
                    </div>
                  )}
                  <div 
                    className="p-3 rounded-lg border border-gray-700 bg-gray-900/50 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() => handlePrintingClick(p)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <RarityIcon rarityCode={p.rarity} size="sm" />
                        <span className="font-semibold text-sm text-gray-200">{p.set.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getEditionName(p.edition) || 'Normal'}
                        </Badge>
                        
                        <div className={cn(
                         "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                          getVariantBadgeStyles(p.rarity, p.foiling)
                        )}>
                          {getFoilingName(p.foiling, p.is_extended_art)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Price section with affiliate link */}
                    {p.tcg_low != null && p.tcg_low > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        {/* Price display */}
                        <div className="text-lg font-semibold text-green-400">
                          ${p.tcg_low.toFixed(2)}
                        </div>
                        
                        {/* Affiliate buy button */}
                        {p.tcgplayer_url && (
                          <TcgAffiliateLink
                            tcgplayerUrl={p.tcgplayer_url}
                            feature="PrintingsDialogPurchase"
                            onClick={(e) => e.stopPropagation()} // Prevent dialog from closing
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded hover:bg-blue-900/20 border border-blue-800/50"
                            title="Purchase on TCGPlayer"
                          >
                            <img 
                              src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                              alt="TCGPlayer"
                              className="h-3 w-auto"
                            />
                            <span>Buy</span>
                          </TcgAffiliateLink>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
// //components/ViewPrintingsDialog.tsx
// "use client";

// import React, { useState, useEffect } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// import { Loader2 } from "lucide-react";
// import { RarityIcon } from '@/components/shared/RarityIcon';
// import { getSetName, getFoilingName, getEditionName, getVariantBadgeStyles } from "@/lib/fab-formatters";
// import { cn } from "@/lib/utils";

// import { Badge } from "@/components/ui/badge"; // We will use Badge for styling

// // Custom Sorting Logic - this remains the same
// const sortPrintings = (printings: any[]) => {
//   const editionOrder: Record<string, number> = { 'a': 0, 'f': 1, 'u': 2, 'n': 3 };
//   const variantOrder: Record<string, number> = { 'v': 0, 'ea': 1, 'c': 2, 'r': 3, 's': 4 };
//   const getVariantSortKey = (p: any): number => {
//     if (p.rarity === 'v') return variantOrder['v'];
//     if (p.is_extended_art) return variantOrder['ea'];
//     return variantOrder[p.foiling] ?? 99;
//   };
//   return [...printings].sort((a, b) => {
//     const setNameA = getSetName(a.set);
//     const setNameB = getSetName(b.set);
//     if (setNameA < setNameB) return -1;
//     if (setNameA > setNameB) return 1;
//     const editionA = editionOrder[a.edition] ?? 99;
//     const editionB = editionOrder[b.edition] ?? 99;
//     if (editionA !== editionB) return editionA - editionB;
//     const variantA = getVariantSortKey(a);
//     const variantB = getVariantSortKey(b);
//     return variantA - variantB;
//   });
// };

// export default function ViewPrintingsDialog({ 
//   open, onOpenChange, cardName, cardUniqueId, onSelectPrinting 
// }: {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   cardName: string;
//   cardUniqueId: string;
//   onSelectPrinting: (printing: any) => void; 
// }) {
//   const [printings, setPrintings] = useState<any[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     if (open && cardUniqueId) {
//       const fetchPrintings = async () => {
//         setLoading(true);
//         setError(null);
//         try {
//           const response = await fetch(`/api/search?cardUniqueId=${cardUniqueId}&limit=50&show=browse_bulk`);
//           const data = await response.json();
//           if (data.success && data.data?.printings) {
//             const sorted = sortPrintings(data.data.printings);
//             setPrintings(sorted);
//           } else { throw new Error('Could not find other printings.'); }
//         } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load printings');
//         } finally { setLoading(false); }
//       };
//       fetchPrintings();
//     }
//   }, [open, cardUniqueId]);

//   const handlePrintingClick = (printing: any) => {
//     onSelectPrinting(printing);
//     onOpenChange(false);
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-gray-800 border-gray-700">
//         <DialogHeader>
//           <DialogTitle className="text-gray-100">Available Printings: {cardName}</DialogTitle>
//           <DialogDescription>
//             Click on a printing to update the card display.
//           </DialogDescription>
//         </DialogHeader>

//         <div className="flex-1 overflow-y-auto pr-2 space-y-2">
//           {loading ? (
//             <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
//           ) : error ? (
//             <p className="text-red-400 text-center py-8">{error}</p>
//           ) : (
//             printings.map((p, index) => {
//               const showSetHeader = index === 0 || p.set !== printings[index - 1].set;
              
//               return (
//                 <React.Fragment key={p.printing_id}>
//                   {showSetHeader && (
//                     <div className="font-bold text-lg pt-4 pb-1 border-b border-gray-700 text-gray-200">
//                       {getSetName(p.set)}
//                     </div>
//                   )}
//                   <div 
//                     className="p-3 rounded-lg border border-gray-700 bg-gray-900/50 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-700 transition-colors"
//                     onClick={() => handlePrintingClick(p)}
//                   >
//                     <div>
//                       <div className="flex items-center gap-2 mb-1.5">
//                         <RarityIcon rarityCode={p.rarity} size="sm" />
//                         <span className="font-semibold text-sm text-gray-200">{p.set.toUpperCase()}</span>
//                       </div>
//                       <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="text-xs">
//                           {getEditionName(p.edition) || 'Normal'}
//                         </Badge>
                        
//                         {/* --- THE FIX IS HERE --- */}
//                         {/* We use a styled <div> instead of a <Badge> to ensure gradients apply */}
//                         <div className={cn(
//                          "text-xs font-semibold px-2.5 py-0.5 rounded-full",
//                           getVariantBadgeStyles(p.rarity, p.foiling)
//                         )}>
//                           {getFoilingName(p.foiling, p.is_extended_art)}
//                         </div>
//                       </div>
//                     </div>
//                     {p.tcg_low != null && p.tcg_low > 0 && (
//                       <div className="text-lg font-semibold text-green-400">
//                         ${p.tcg_low.toFixed(2)}
//                       </div>
//                     )}
//                   </div>
//                 </React.Fragment>
//               );
//             })
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }


// // iajfeicojeijeaw





// // "use client";

// // import { Badge } from "@/components/ui/badge";
// // import React, { useState, useEffect } from "react";
// // import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// // import { Loader2 } from "lucide-react";
// // import { RarityIcon } from '@/components/shared/RarityIcon';
// // import { getSetName, getFoilingName, getEditionName, getVariantStyles } from "@/lib/fab-formatters";
// // import { cn } from "@/lib/utils";




// // // For better type safety, let's update this interface to include all expected fields
// // interface PrintingOption {
// //   printing_id: string;
// //   set: string;
// //   edition: string;
// //   foiling: string;
// //   rarity: string;
// //   tcg_low?: number;
// //   tcg_mid?: number;
// //   tcg_high?: number;
// //   tcg_market?: number;
// //   is_extended_art?: boolean;
// // }

// // interface ViewPrintingsDialogProps {
// //   open: boolean;
// //   onOpenChange: (open: boolean) => void;
// //   cardName: string;
// //   cardUniqueId: string;
// //   onSelectPrinting: (printing: any) => void; 
// // }

// // export default function ViewPrintingsDialog({ 
// //   open, 
// //   onOpenChange, 
// //   cardName, 
// //   cardUniqueId, 
// //   onSelectPrinting 
// // }: ViewPrintingsDialogProps) {
// //   const [printings, setPrintings] = useState<PrintingOption[]>([]);
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState<string | null>(null);

// //   useEffect(() => {
// //     if (open && cardUniqueId) {
// //       const fetchPrintings = async () => {
// //         setLoading(true);
// //         setError(null);
// //         try {
// //           // Use the `browse_bulk` response mode to get all the data we need
// //           const response = await fetch(`/api/search?cardUniqueId=${cardUniqueId}&limit=50&show=browse_bulk`);
// //           const data = await response.json();
// //           if (data.success && data.data?.printings) {
// //             const sorted = sortPrintings(data.data.printings);
// //             setPrintings(sorted);
// //           } else {
// //             throw new Error('Could not find other printings.');
// //           }
// //         } catch (err) {
// //           setError(err instanceof Error ? err.message : 'Failed to load printings');
// //         } finally {
// //           setLoading(false);
// //         }
// //       };
// //       fetchPrintings();
// //     }
// //   }, [open, cardUniqueId]);

// //   const sortPrintings = (printings: any[]) => {
// //     const editionOrder: Record<string, number> = { 'a': 0, 'f': 1, 'u': 2, 'n': 3 };
// //     const variantOrder: Record<string, number> = { 'v': 0, 'ea': 1, 'c': 2, 'r': 3, 's': 4 };
  
// //     const getVariantSortKey = (p: any): number => {
// //       if (p.rarity === 'v') return variantOrder['v']; // Marvel
// //       if (p.is_extended_art) return variantOrder['ea']; // Extended Art
// //       return variantOrder[p.foiling] ?? 99; // CF, RF, NF
// //     };
  
// //     return printings.sort((a, b) => {
// //       // Level 1: Sort by Set name alphabetically
// //       const setNameA = getSetName(a.set);
// //       const setNameB = getSetName(b.set);
// //       if (setNameA < setNameB) return -1;
// //       if (setNameA > setNameB) return 1;
  
// //       // Level 2: Sort by custom Edition order
// //       const editionA = editionOrder[a.edition] ?? 99;
// //       const editionB = editionOrder[b.edition] ?? 99;
// //       if (editionA !== editionB) return editionA - editionB;
  
// //       // Level 3: Sort by custom Variant/Foiling order
// //       const variantA = getVariantSortKey(a);
// //       const variantB = getVariantSortKey(b);
// //       return variantA - variantB;
// //     });
// //   };

// //   const handlePrintingClick = (printing: PrintingOption) => {
// //     // --- THE FIX IS HERE ---
// //     // Instead of creating a new, incomplete object, we pass the
// //     // full, original `printing` object back to the hook.
// //     onSelectPrinting(printing);
    
// //     onOpenChange(false); // Close the dialog
// //   };

// //   return (
// //     <Dialog open={open} onOpenChange={onOpenChange}>
// //       <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
// //         <DialogHeader>
// //           <DialogTitle>Available Printings: {cardName}</DialogTitle>
// //           <DialogDescription>
// //             Click on a printing to update the card display.
// //           </DialogDescription>
// //         </DialogHeader>

// //         <div className="flex-1 overflow-y-auto pr-2 space-y-2">
// //           {loading ? (
// //             <div className="flex items-center justify-center py-8">
// //               <Loader2 className="w-6 h-6 animate-spin" />
// //             </div>
// //           ) : error ? (
// //             <p className="text-destructive text-center py-8">{error}</p>
// //           ) : (
// //             printings.map((p) => (
// //               <div 
// //                 key={p.printing_id} 
// //                 className="p-3 rounded-lg border bg-muted/50 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted transition-colors"
// //                 onClick={() => handlePrintingClick(p)}
// //               >
// //                 <div>
// //                   <div className="flex items-center gap-2 mb-1">
// //                     <RarityIcon rarityCode={p.rarity} size="sm" />
// //                     <span className="font-mono text-xs uppercase">{getSetName(p.set)}</span>
// //                   </div>
// //                   <div className="flex items-center gap-2">
// //                     {/* Use our enhanced formatter here as well */}
// //                     <Badge className="text-xs">{getFoilingName(p.foiling, p.is_extended_art)}</Badge>
// //                     <Badge variant="outline" className="text-xs">{getEditionName(p.edition)}</Badge>
// //                   </div>
// //                 </div>
// //                 {p.tcg_low != null && p.tcg_low > 0 && (
// //                   <div className="text-lg font-semibold text-green-400">
// //                     ${p.tcg_low.toFixed(2)}
// //                   </div>
// //                 )}
// //               </div>
// //             ))
// //           )}
// //         </div>
// //       </DialogContent>
// //     </Dialog>
// //   );
// // }
// // // "use client";

// // // import React, { useState, useEffect } from "react";
// // // import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// // // import { Badge } from "@/components/ui/badge";
// // // import { Loader2 } from "lucide-react";
// // // import { RarityIcon } from '@/components/shared/RarityIcon';
// // // import { getSetName, getFoilingName, getEditionName } from "@/lib/fab-formatters";

// // // interface PrintingOption {
// // //   printing_id: string;
// // //   set: string;
// // //   edition: string;
// // //   foiling: string;
// // //   rarity: string;
// // //   tcg_market?: number;
// // // }

// // // interface ViewPrintingsDialogProps {
// // //   open: boolean;
// // //   onOpenChange: (open: boolean) => void;
// // //   cardName: string;
// // //   cardUniqueId: string;
// // //   onSelectPrinting: (printing: any) => void; // Add this callback
// // // }

// // // export default function ViewPrintingsDialog({ 
// // //   open, 
// // //   onOpenChange, 
// // //   cardName, 
// // //   cardUniqueId, 
// // //   onSelectPrinting 
// // // }: ViewPrintingsDialogProps) {
// // //   const [printings, setPrintings] = useState<PrintingOption[]>([]);
// // //   const [loading, setLoading] = useState(false);
// // //   const [error, setError] = useState<string | null>(null);

// // //   useEffect(() => {
// // //     if (open && cardUniqueId) {
// // //       const fetchPrintings = async () => {
// // //         setLoading(true);
// // //         setError(null);
// // //         try {
// // //           const response = await fetch(`/api/search?cardUniqueId=${cardUniqueId}&limit=50&show=summary`);
// // //           const data = await response.json();
// // //           if (data.success && data.data?.printings) {
// // //             setPrintings(data.data.printings);
// // //           } else {
// // //             throw new Error('Could not find other printings.');
// // //           }
// // //         } catch (err) {
// // //           setError(err instanceof Error ? err.message : 'Failed to load printings');
// // //         } finally {
// // //           setLoading(false);
// // //         }
// // //       };
// // //       fetchPrintings();
// // //     }
// // //   }, [open, cardUniqueId]);

// // //   const handlePrintingClick = (printing: PrintingOption) => {
// // //     // Transform the printing data to match your card format
// // //     const transformedCard = {
// // //       printing_id: printing.printing_id,
// // //       card_unique_id: cardUniqueId,
// // //       display_name: cardName,
// // //       image_url: printing.image_url,
// // //       set: printing.set,
// // //       rarity: printing.rarity,
// // //       foiling: printing.foiling,
// // //       edition: printing.edition,
// // //       tcg_market: printing.tcg_market,
// // //     };
    
// // //     onSelectPrinting(transformedCard);
// // //     onOpenChange(false); // Close the dialog
// // //   };

// // //   return (
// // //     <Dialog open={open} onOpenChange={onOpenChange}>
// // //       <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
// // //         <DialogHeader>
// // //           <DialogTitle>Available Printings: {cardName}</DialogTitle>
// // //           <DialogDescription>
// // //             Click on a printing to update the card display.
// // //           </DialogDescription>
// // //         </DialogHeader>

// // //         <div className="flex-1 overflow-y-auto pr-2 space-y-2">
// // //           {loading ? (
// // //             <div className="flex items-center justify-center py-8">
// // //               <Loader2 className="w-6 h-6 animate-spin" />
// // //             </div>
// // //           ) : error ? (
// // //             <p className="text-destructive text-center py-8">{error}</p>
// // //           ) : (
// // //             printings.map((p) => (
// // //               <div 
// // //                 key={p.printing_id} 
// // //                 className="p-3 rounded-lg border bg-muted/50 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted transition-colors"
// // //                 onClick={() => handlePrintingClick(p)}
// // //               >
// // //                 <div>
// // //                   <div className="flex items-center gap-2 mb-1">
// // //                     <RarityIcon rarityCode={p.rarity} size="sm" />
// // //                     <span className="font-mono text-xs uppercase">{getSetName(p.set)}</span>
// // //                   </div>
// // //                   <div className="flex items-center gap-2">
// // //                     <Badge className="text-xs">{getFoilingName(p.foiling)}</Badge>
// // //                     <Badge variant="outline" className="text-xs">{getEditionName(p.edition)}</Badge>
// // //                   </div>
// // //                 </div>
// // //                 {p.tcg_market != null && p.tcg_market > 0 && (
// // //                   <div className="text-lg font-semibold text-green-400">
// // //                     ${p.tcg_market.toFixed(2)}
// // //                   </div>
// // //                 )}
// // //               </div>
// // //             ))
// // //           )}
// // //         </div>
// // //       </DialogContent>
// // //     </Dialog>
// // //   );
// // // }
// // // // // components/ViewPrintingsDialog.tsx
// // // // "use client";

// // // // import React, { useState, useEffect } from "react";
// // // // import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// // // // import { Badge } from "@/components/ui/badge";
// // // // import { Loader2 } from "lucide-react";
// // // // import { RarityIcon } from '@/components/shared/RarityIcon';
// // // // import { getSetName, getFoilingName, getEditionName } from "@/lib/fab-formatters";

// // // // interface PrintingOption {
// // // //   printing_id: string;
// // // //   set: string;
// // // //   edition: string;
// // // //   foiling: string;
// // // //   rarity: string;
// // // //   tcg_market?: number;
// // // // }


// // // // interface ViewPrintingsDialogProps {
// // // //     open: boolean;
// // // //     onOpenChange: (open: boolean) => void;
// // // //     cardName: string;
// // // //     printings: any[]; // <-- Receives the list of printings directly
// // // //     onSelectPrinting: (printing: any) => void; // <-- New callback prop
// // // //   }

// // // // export default function ViewPrintingsDialog({ open, onOpenChange, cardName, cardUniqueId }: ViewPrintingsDialogProps) {
// // // //   const [printings, setPrintings] = useState<PrintingOption[]>([]);
// // // //   const [loading, setLoading] = useState(false);
// // // //   const [error, setError] = useState<string | null>(null);

// // // //   useEffect(() => {
// // // //     // Only fetch when the dialog is open and we have a valid card ID
// // // //     if (open && cardUniqueId) {
// // // //       const fetchPrintings = async () => {
// // // //         setLoading(true);
// // // //         setError(null);
// // // //         try {
// // // //           // Use the generic card_unique_id to find all its versions
// // // //           const response = await fetch(`/api/search?cardUniqueId=${cardUniqueId}&limit=50&show=summary`);
// // // //           const data = await response.json();
// // // //           if (data.success && data.data?.printings) {
// // // //             setPrintings(data.data.printings);
// // // //           } else {
// // // //             throw new Error('Could not find other printings.');
// // // //           }
// // // //         } catch (err) {
// // // //           setError(err instanceof Error ? err.message : 'Failed to load printings');
// // // //         } finally {
// // // //           setLoading(false);
// // // //         }
// // // //       };
// // // //       fetchPrintings();
// // // //     }
// // // //   }, [open, cardUniqueId]);

// // // //   return (
// // // //     <Dialog open={open} onOpenChange={onOpenChange}>
// // // //       <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
// // // //         <DialogHeader>
// // // //           <DialogTitle>Available Printings: {cardName}</DialogTitle>
// // // //           <DialogDescription>
// // // //             Explore different versions and prices for this card.
// // // //           </DialogDescription>
// // // //         </DialogHeader>

// // // //         <div className="flex-1 overflow-y-auto pr-2 space-y-2">
// // // //           {loading ? (
// // // //             <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
// // // //           ) : error ? (
// // // //             <p className="text-destructive text-center py-8">{error}</p>
// // // //           ) : (
// // // //             printings.map((p) => (
// // // //               <div key={p.printing_id} className="p-3 rounded-lg border bg-muted/50 flex items-center justify-between gap-4">
// // // //                 <div>
// // // //                   <div className="flex items-center gap-2 mb-1">
// // // //                     <RarityIcon rarityCode={p.rarity} size="sm" />
// // // //                     <span className="font-mono text-xs uppercase">{getSetName(p.set)}</span>
// // // //                   </div>
// // // //                   <div className="flex items-center gap-2">
// // // //                     <Badge className="text-xs">{getFoilingName(p.foiling)}</Badge>
// // // //                     <Badge variant="outline" className="text-xs">{getEditionName(p.edition)}</Badge>
// // // //                   </div>
// // // //                 </div>
// // // //                 {p.tcg_market != null && p.tcg_market > 0 && (
// // // //                   <div className="text-lg font-semibold text-green-400">
// // // //                     ${p.tcg_market.toFixed(2)}
// // // //                   </div>
// // // //                 )}
// // // //               </div>
// // // //             ))
// // // //           )}
// // // //         </div>
// // // //       </DialogContent>
// // // //     </Dialog>
// // // //   );
// // // // }

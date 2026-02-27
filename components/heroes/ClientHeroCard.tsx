// components/heroes/ClientHeroCard.tsx
"use client";

import { useState, useEffect } from 'react';
import PublicHeroCardDisplay from './PublicHeroCardDisplay';

interface ClientHeroCardProps {
  printingId: string;
  overrideCardData?: any; // Allow parent to override the card data
  onFoilBadgeClick?: () => void;
}

export default function ClientHeroCard({ 
  printingId, 
  overrideCardData, 
  onFoilBadgeClick 
}: ClientHeroCardProps) {
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If parent provides override data, use that instead of fetching
    if (overrideCardData) {
      setCardData(overrideCardData);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchCardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use your existing API endpoint
        const response = await fetch(`/api/printings/search?printingIds=${printingId}`);
        const data = await response.json();
        
        if (data.success && data.data?.printings?.length > 0) {
          // Get the first (and should be only) printing from the results
          const printing = data.data.printings[0];
          
          // Add any missing properties that PublicHeroCardDisplay might expect
          const enhancedPrinting = {
            ...printing,
            // Ensure tcgplayer_url is properly set (API returns null sometimes)
            tcgplayer_url: printing.tcgplayer_url || `https://www.tcgplayer.com/search/flesh-and-blood/product?q=${encodeURIComponent(printing.display_name)}`,
            // Add card_unique_id if your ViewPrintingsDialog needs it
            card_unique_id: printing.card_unique_id || printing.printing_card_id
          };
          
          setCardData(enhancedPrinting);
        } else {
          throw new Error('Card not found');
        }
      } catch (err) {
        console.error(`[ClientHeroCard Error] Failed to fetch printingId ${printingId}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load card');
      } finally {
        setLoading(false);
      }
    };

    if (printingId) {
      fetchCardData();
    }
  }, [printingId, overrideCardData]);

  if (loading) {
    return (
      <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg animate-pulse">
        <div className="relative aspect-[63/88] w-full bg-gray-300 dark:bg-gray-600"></div>
        <div className="p-3 space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col rounded-lg overflow-hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 shadow-lg p-4">
        <div className="text-red-600 dark:text-red-400 text-sm font-medium">
          Load Error
        </div>
        <div className="text-red-500 dark:text-red-300 text-xs mt-1">
          {printingId}
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="flex flex-col rounded-lg overflow-hidden bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 shadow-lg p-4">
        <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
          Card not found
        </div>
        <div className="text-yellow-500 dark:text-yellow-300 text-xs mt-1">
          {printingId}
        </div>
      </div>
    );
  }

  // Enable the printing dialog for carousel cards
  return (
    <PublicHeroCardDisplay 
      card={cardData} 
      variant="carousel" 
      enablePrintingDialog={true}
      onFoilBadgeClick={onFoilBadgeClick}
    />
  );
}
// // components/heroes/ClientHeroCard.tsx
// "use client";

// import { useState, useEffect } from 'react';
// import PublicHeroCardDisplay from './PublicHeroCardDisplay';

// interface ClientHeroCardProps {
//   printingId: string;
// }

// export default function ClientHeroCard({ printingId }: ClientHeroCardProps) {
//   const [cardData, setCardData] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchCardData = async () => {
//       try {
//         setLoading(true);
//         setError(null);
        
//         // Use your existing API endpoint
//         const response = await fetch(`/api/search?printingIds=${printingId}`);
//         const data = await response.json();
        
//         if (data.success && data.data?.printings?.length > 0) {
//           // Get the first (and should be only) printing from the results
//           const printing = data.data.printings[0];
          
//           // Add any missing properties that PublicHeroCardDisplay might expect
//           const enhancedPrinting = {
//             ...printing,
//             // Ensure tcgplayer_url is properly set (API returns null sometimes)
//             tcgplayer_url: printing.tcgplayer_url || `https://www.tcgplayer.com/search/flesh-and-blood/product?q=${encodeURIComponent(printing.display_name)}`,
//             // Add card_unique_id if your ViewPrintingsDialog needs it
//             card_unique_id: printing.card_unique_id || printing.printing_card_id
//           };
          
//           setCardData(enhancedPrinting);
//         } else {
//           throw new Error('Card not found');
//         }
//       } catch (err) {
//         console.error(`[ClientHeroCard Error] Failed to fetch printingId ${printingId}:`, err);
//         setError(err instanceof Error ? err.message : 'Failed to load card');
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (printingId) {
//       fetchCardData();
//     }
//   }, [printingId]);

//   if (loading) {
//     return (
//       <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg animate-pulse">
//         <div className="relative aspect-[63/88] w-full bg-gray-300 dark:bg-gray-600"></div>
//         <div className="p-3 space-y-2">
//           <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
//           <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="flex flex-col rounded-lg overflow-hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 shadow-lg p-4">
//         <div className="text-red-600 dark:text-red-400 text-sm font-medium">
//           Load Error
//         </div>
//         <div className="text-red-500 dark:text-red-300 text-xs mt-1">
//           {printingId}
//         </div>
//       </div>
//     );
//   }

//   if (!cardData) {
//     return (
//       <div className="flex flex-col rounded-lg overflow-hidden bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 shadow-lg p-4">
//         <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
//           Card not found
//         </div>
//         <div className="text-yellow-500 dark:text-yellow-300 text-xs mt-1">
//           {printingId}
//         </div>
//       </div>
//     );
//   }

//   // Enable the printing dialog for carousel cards
//   return (
//     <PublicHeroCardDisplay 
//       card={cardData} 
//       variant="carousel" 
//       enablePrintingDialog={true}
//     />
//   );
// }

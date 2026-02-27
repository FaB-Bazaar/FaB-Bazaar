"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown'; 

interface SearchResult {
  printing_id: string;
  display_name: string;
  name: string;
  tcg_low?: number | null;
  set: string;
  printing_card_id: string;
  rarity: string;
  foiling: string;
  edition?: string;
  color?: string;
  hasOwners?: boolean | null;
}

interface MobileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  defaultQuery?: string;
}

export default function MobileSearch({ isOpen, onClose, defaultQuery }: MobileSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setHasSearched(false);
    } else if (defaultQuery && defaultQuery.trim()) {
      // Set the query and auto-search when opened with defaultQuery
      setQuery(defaultQuery);
      setTimeout(() => {
        handleSearchWithQuery(defaultQuery);
      }, 200);
    }
  }, [isOpen, defaultQuery]);

  // Helper function to search with a specific query
  const handleSearchWithQuery = async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length < 3) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const searchResponse = await fetch('/api/printings/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: { name: normalizedQuery },
          options: { limit: 20, show: 'summary', sortBy: 'name', sortOrder: 'asc' },
        }),
      });

      if (!searchResponse.ok) throw new Error('Search failed');

      const searchData = await searchResponse.json();
      const printings = searchData.data?.printings || [];
      if (printings.length === 0) {
        setResults([]);
        return;
      }

      const printingIds = printings.map((p: SearchResult) => p.printing_id).join(',');

      const ownershipResponse = await fetch(`/api/whohas?printingIds=${encodeURIComponent(printingIds)}&forTradeOnly=true`);

      let printingsWithOwners = new Set<string>();

      if (ownershipResponse.ok) {
        const ownershipData = await ownershipResponse.json();

        if (ownershipData.success && ownershipData.owners) {
          ownershipData.owners.forEach((owner: any) => {
            owner.binders?.forEach((binder: any) => {
              binder.matching_cards?.forEach((card: any) => {
                if (card.printing_id) {
                  printingsWithOwners.add(card.printing_id);
                }
              });
            });
          });
        }
      }

      const resultsWithOwnership = printings.map((printing: SearchResult) => ({
        ...printing,
        hasOwners: printingsWithOwners.has(printing.printing_id),
      }));

      setResults(resultsWithOwnership);

    } catch (err) {
      setError('Failed to search. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await handleSearchWithQuery(query);
  };

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined || price === 0) return '-';
    return `$${price.toFixed(2)}`;
  };

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case 'common': case 'c': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'rare': case 'r': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'super rare': case 'sr': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'majestic': case 'm': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'legendary': case 'l': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'fabled': case 'f': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'promo': case 'p': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const getColorTextStyle = (color?: string) => {
    if (!color || color === '') return 'text-gray-900 dark:text-gray-100';
    switch (color.toLowerCase()) {
      case 'red': return 'text-red-600 dark:text-red-400';
      case 'blue': return 'text-blue-600 dark:text-blue-400';
      case 'yellow': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-900 dark:text-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 md:hidden">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Close search">
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input ref={searchInputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards..." className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-gray-100" />
            </div>
            <button type="submit" disabled={query.length < 3 || loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>
        {query.length > 0 && query.length < 3 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Type at least 3 characters to search</p>}
      </div>

      {/* Results */}
      <div className="overflow-y-auto h-[calc(100vh-73px)]">
        {error && <div className="p-4 text-center text-red-600 dark:text-red-400">{error}</div>}
        {!loading && hasSearched && query.length >= 3 && results.length === 0 && (
          <div className="p-8 text-center"><p className="text-gray-500 dark:text-gray-400">No cards found for "{query.trim()}"</p></div>
        )}
        {results.length > 0 && (
          <div className="px-4 py-2">
            {/* Group results by card name and sort by price within groups */}
            {(() => {
              const groupedResults = results.reduce((groups, result) => {
                const cardName = result.display_name || result.name;
                if (!groups[cardName]) {
                  groups[cardName] = [];
                }
                groups[cardName].push(result);
                return groups;
              }, {} as Record<string, SearchResult[]>);

              // Sort printings within each group by TCG low price (highest to lowest)
              Object.keys(groupedResults).forEach(cardName => {
                groupedResults[cardName].sort((a, b) => {
                  const priceA = a.tcg_low || 0;
                  const priceB = b.tcg_low || 0;
                  return priceB - priceA; // Descending order (highest first)
                });
              });

              return Object.entries(groupedResults).map(([cardName, cardResults]) => (
                <div key={cardName} className="mb-6">
                  {/* Card Name Header */}
                  <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <h2 className={`font-semibold text-lg capitalize ${getColorTextStyle(cardResults[0]?.color)}`}>
                      {cardName}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {cardResults.length} printing{cardResults.length !== 1 ? 's' : ''} found
                    </p>
                  </div>

                  {/* Printings for this card */}
                  <div className="space-y-2 mb-4">
                    {cardResults.map((result) => (
                      <div key={result.printing_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Link
                            href={`/printing/${result.printing_id}?from=search&query=${encodeURIComponent(query)}`}
                            onClick={onClose}
                            className={`font-mono text-sm font-semibold min-w-[60px] hover:underline transition-colors ${getColorTextStyle(result.color)} hover:opacity-80`}
                          >
                            {result.printing_card_id}
                          </Link>
                          <div className="flex gap-1 flex-wrap">
                            {result.foiling && result.foiling !== 's' && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                                {result.foiling === 'r' ? 'RF' : result.foiling === 'c' ? 'CF' : result.foiling.toUpperCase()}
                              </span>
                            )}
                            {result.edition && result.edition !== 'n' && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                                {result.edition === 'f' ? '1st' : result.edition === 'u' ? 'Unl' : result.edition.toUpperCase()}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${getRarityBadgeColor(result.rarity)}`}>
                              {result.rarity?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                              {formatPrice(result.tcg_low)}
                            </div>
                          </div>
                          <div className="flex items-center">
                            {result.hasOwners ? (
                              <WhoHasDropdown
                                printingId={result.printing_id}
                                cardName={result.display_name || result.name}
                                searchMode="printing"
                                buttonText=""
                                className="relative z-10 p-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center min-h-[40px] min-w-[40px]"
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
// //components/MobileSearch.tsx
// import { useState, useEffect, useRef } from 'react'
// import { Search, X, Loader2, Users } from 'lucide-react'
// import Link from 'next/link'
// import MobileWhoHas from './MobileWhoHas'

// interface SearchResult {
//   printing_id: string
//   display_name: string
//   name: string
//   tcg_low?: number | null
//   set: string
//   printing_card_id: string
//   rarity: string
//   foiling: string
//   edition?: string
//   color?: string  // Added color property
//   hasOwners?: boolean | null // null = not checked, boolean = checked
// }

// interface MobileSearchProps {
//   isOpen: boolean
//   onClose: () => void
// }

// export default function MobileSearch({ isOpen, onClose }: MobileSearchProps) {
//   const [query, setQuery] = useState('')
//   const [results, setResults] = useState<SearchResult[]>([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [hasSearched, setHasSearched] = useState(false)
//   const searchInputRef = useRef<HTMLInputElement>(null)

//   // Focus input when opened
//   useEffect(() => {
//     if (isOpen && searchInputRef.current) {
//       setTimeout(() => searchInputRef.current?.focus(), 100)
//     }
//   }, [isOpen])

//   // Clear results when closed
//   useEffect(() => {
//     if (!isOpen) {
//       setQuery('')
//       setResults([])
//       setError(null)
//       setHasSearched(false)
//     }
//   }, [isOpen])

//   const handleSearch = async (e?: React.FormEvent) => {
//     e?.preventDefault()

//     const normalizedQuery = query.trim().toLowerCase()

//     if (normalizedQuery.length < 3) {
//       return
//     }

//     setLoading(true)
//     setError(null)
//     setHasSearched(true)

//     try {
//       // First, get the search results
//       const searchResponse = await fetch('/api/printings/search', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           filters: {
//             name: normalizedQuery,
//           },
//           options: {
//             limit: 20,
//             show: 'summary',
//             sortBy: 'name',
//             sortOrder: 'asc',
//           },
//         }),
//       })

//       if (!searchResponse.ok) {
//         throw new Error('Search failed')
//       }

//       const searchData = await searchResponse.json()
//       const printings = searchData.data?.printings || []

//       if (printings.length === 0) {
//         setResults([])
//         return
//       }

//       // Then check ownership for all printings
//       const printingIds = printings.map((p: SearchResult) => p.printing_id).join(',')
//       const ownershipResponse = await fetch(`/api/whohas?printingIds=${encodeURIComponent(printingIds)}&forTradeOnly=true&maxResults=1`)

//       let printingsWithOwners = new Set<string>()

//       if (ownershipResponse.ok) {
//         const ownershipData = await ownershipResponse.json()

//         if (ownershipData.success && ownershipData.owners) {
//           ownershipData.owners.forEach((owner: any) => {
//             owner.matching_cards?.forEach((card: any) => {
//               if (card.printing_id) {
//                 printingsWithOwners.add(card.printing_id)
//               }
//             })
//           })
//         }
//       }

//       // Set results with ownership info already included
//       const resultsWithOwnership = printings.map((printing: SearchResult) => {
//         const hasOwners = printingsWithOwners.has(printing.printing_id)
//         return {
//           ...printing,
//           hasOwners
//         }
//       })

//       setResults(resultsWithOwnership)

//     } catch (err) {
//       setError('Failed to search. Please try again.')
//       console.error('Search error:', err)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const formatPrice = (price?: number | null) => {
//     if (price === null || price === undefined || price === 0) {
//       return '-'
//     }
//     return `${price.toFixed(2)}`
//   }

//   const getRarityBadgeColor = (rarity: string) => {
//     switch (rarity?.toLowerCase()) {
//       case 'common':
//       case 'c':
//         return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
//       case 'rare':
//       case 'r':
//         return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
//       case 'super rare':
//       case 'sr':
//         return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
//       case 'majestic':
//       case 'm':
//         return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
//       case 'legendary':
//       case 'l':
//         return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
//       case 'fabled':
//       case 'f':
//         return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
//       case 'promo':
//       case 'p':
//         return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
//       default:
//         return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
//     }
//   }

//   // New function to get color-based text styling
//   const getColorTextStyle = (color?: string) => {
//     if (!color || color === '') {
//       return 'text-gray-900 dark:text-gray-100' // Default colors
//     }

//     switch (color.toLowerCase()) {
//       case 'red':
//         return 'text-red-600 dark:text-red-400'
//       case 'blue':
//         return 'text-blue-600 dark:text-blue-400'
//       case 'yellow':
//         return 'text-yellow-600 dark:text-yellow-400'
//       default:
//         return 'text-gray-900 dark:text-gray-100'
//     }
//   }

//   if (!isOpen) return null

//   return (
//     <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 md:hidden">
//       {/* Header */}
//       <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3">
//         <div className="flex items-center gap-3">
//           <button
//             onClick={onClose}
//             className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
//             aria-label="Close search"
//           >
//             <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
//           </button>

//           <form onSubmit={handleSearch} className="flex-1 flex gap-2">
//             <div className="flex-1 relative">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
//               <input
//                 ref={searchInputRef}
//                 type="text"
//                 value={query}
//                 onChange={(e) => setQuery(e.target.value)}
//                 placeholder="Search cards..."
//                 className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-gray-100"
//               />
//             </div>
//             <button
//               type="submit"
//               disabled={query.length < 3 || loading}
//               className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center"
//             >
//               {loading ? (
//                 <Loader2 className="h-5 w-5 animate-spin" />
//               ) : (
//                 'Search'
//               )}
//             </button>
//           </form>
//         </div>

//         {query.length > 0 && query.length < 3 && (
//           <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
//             Type at least 3 characters to search
//           </p>
//         )}
//       </div>

//       {/* Results */}
//       <div className="overflow-y-auto h-[calc(100vh-73px)]">
//         {error && (
//           <div className="p-4 text-center text-red-600 dark:text-red-400">
//             {error}
//           </div>
//         )}

//         {!loading && hasSearched && query.length >= 3 && results.length === 0 && (
//           <div className="p-8 text-center">
//             <p className="text-gray-500 dark:text-gray-400">
//                 No cards found for "{query.trim()}"
//             </p>
//           </div>
//         )}

//         {results.length > 0 && (
//           <div className="px-4 py-2">
//             {/* Search term header - Apply color styling here */}
//             <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
//               <h2 className={`font-semibold text-lg capitalize ${getColorTextStyle(results[0]?.color)}`}>
//                 {results[0]?.display_name || results[0]?.name || query}
//               </h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">
//                 {results.length} variant{results.length !== 1 ? 's' : ''} found
//               </p>
//             </div>

//             {/* Results grid */}
//             <div className="space-y-2">
//               {results.map((result) => (
//                 <div
//                   key={result.printing_id}
//                   className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
//                 >
//                   <div className="flex items-center gap-3 flex-1 min-w-0">
//                     {/* Card ID - Clickable to printing page */}
//                     <Link
//                       href={`/printing/${result.printing_id}`}
//                       onClick={onClose}
//                       className={`font-mono text-sm font-semibold min-w-[60px] hover:underline transition-colors ${getColorTextStyle(result.color)} hover:opacity-80`}
//                     >
//                       {result.printing_card_id}
//                     </Link>

//                     {/* Edition & Foiling badges */}
//                     <div className="flex gap-1 flex-wrap">
//                       {result.foiling && result.foiling !== 's' && (
//                         <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
//                           {result.foiling === 'r' ? 'RF' : result.foiling === 'c' ? 'CF' : result.foiling.toUpperCase()}
//                         </span>
//                       )}

//                       {result.edition && result.edition !== 'n' && (
//                         <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
//                           {result.edition === 'f' ? '1st' : result.edition === 'u' ? 'Unl' : result.edition.toUpperCase()}
//                         </span>
//                       )}

//                       <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${getRarityBadgeColor(result.rarity)}`}>
//                         {result.rarity?.charAt(0)?.toUpperCase()}
//                       </span>
//                     </div>
//                   </div>

//                   {/* Price and Who Has */}
//                   <div className="flex items-center gap-3">
//                     <div className="text-right">
//                       <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
//                         {formatPrice(result.tcg_low)}
//                       </div>
//                     </div>

//                     {/* Who Has Button - Only show if someone has it */}
//                     <div className="flex items-center">
//                       {result.hasOwners ? (
//                         <MobileWhoHas
//                           printingId={result.printing_id}
//                           cardName={result.display_name || result.name}
//                         />
//                       ) : (
//                         <div className="p-2 text-gray-300 dark:text-gray-600 opacity-30" title="No one has this card for trade">
//                           <Users className="w-4 h-4" />
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }
// // import { useState, useEffect, useRef } from 'react'
// // import { Search, X, Loader2, Users } from 'lucide-react'
// // import MobileWhoHas from './MobileWhoHas'

// // interface SearchResult {
// //   printing_id: string
// //   display_name: string
// //   name: string
// //   tcg_low?: number | null
// //   set: string
// //   printing_card_id: string
// //   rarity: string
// //   foiling: string
// //   edition?: string
// //   color?: string 
// //   hasOwners?: boolean | null
// // }

// // interface MobileSearchProps {
// //   isOpen: boolean
// //   onClose: () => void
// // }

// // export default function MobileSearch({ isOpen, onClose }: MobileSearchProps) {
// //   const [query, setQuery] = useState('')
// //   const [results, setResults] = useState<SearchResult[]>([])
// //   const [loading, setLoading] = useState(false)
// //   const [error, setError] = useState<string | null>(null)
// //   const [hasSearched, setHasSearched] = useState(false)
// //   const searchInputRef = useRef<HTMLInputElement>(null)

// //   // Focus input when opened
// //   useEffect(() => {
// //     if (isOpen && searchInputRef.current) {
// //       setTimeout(() => searchInputRef.current?.focus(), 100)
// //     }
// //   }, [isOpen])

// //   // Clear results when closed
// //   useEffect(() => {
// //     if (!isOpen) {
// //       setQuery('')
// //       setResults([])
// //       setError(null)
// //       setHasSearched(false)
// //     }
// //   }, [isOpen])

// //   const handleSearch = async (e?: React.FormEvent) => {
// //     e?.preventDefault()

// //     const normalizedQuery = query.trim().toLowerCase()
    
// //     if (normalizedQuery.length < 3) {
// //       return
// //     }
  
// //     setLoading(true)
// //     setError(null)
// //     setHasSearched(true)
  
// //     try {
// //       const searchResponse = await fetch('/api/printings/search', {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //         },
// //         body: JSON.stringify({
// //           filters: {
// //             name: normalizedQuery,
// //           },
// //           options: {
// //             limit: 20,
// //             show: 'summary',
// //             sortBy: 'name',
// //             sortOrder: 'asc',
// //           },
// //         }),
// //       })
  
// //       if (!searchResponse.ok) {
// //         throw new Error('Search failed')
// //       }
  
// //       const searchData = await searchResponse.json()
// //       const printings = searchData.data?.printings || []
      
// //       if (printings.length === 0) {
// //         setResults([])
// //         return
// //       }

// //       // Then check ownership for all printings
// //       const printingIds = printings.map((p: SearchResult) => p.printing_id).join(',')
// //       const ownershipResponse = await fetch(`/api/whohas?printingIds=${encodeURIComponent(printingIds)}&forTradeOnly=true&maxResults=1`)
      
// //       let printingsWithOwners = new Set<string>()
      
// //       if (ownershipResponse.ok) {
// //         const ownershipData = await ownershipResponse.json()
        
// //         if (ownershipData.success && ownershipData.owners) {
// //           ownershipData.owners.forEach((owner: any) => {
// //             owner.matching_cards?.forEach((card: any) => {
// //               if (card.printing_id) {
// //                 printingsWithOwners.add(card.printing_id)
// //               }
// //             })
// //           })
// //         }
// //       }

// //       // Set results with ownership info already included
// //       const resultsWithOwnership = printings.map((printing: SearchResult) => {
// //         const hasOwners = printingsWithOwners.has(printing.printing_id)
// //         return {
// //           ...printing,
// //           hasOwners
// //         }
// //       })
      
// //       setResults(resultsWithOwnership)
      
// //     } catch (err) {
// //       setError('Failed to search. Please try again.')
// //       console.error('Search error:', err)
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   const formatPrice = (price?: number | null) => {
// //     if (price === null || price === undefined || price === 0) {
// //       return '-'
// //     }
// //     return `${price.toFixed(2)}`
// //   }

// //   const getRarityBadgeColor = (rarity: string) => {
// //     switch (rarity?.toLowerCase()) {
// //       case 'common': 
// //       case 'c':
// //         return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
// //       case 'rare': 
// //       case 'r':
// //         return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
// //       case 'super rare': 
// //       case 'sr':
// //         return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
// //       case 'majestic': 
// //       case 'm':
// //         return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
// //       case 'legendary': 
// //       case 'l':
// //         return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
// //       case 'fabled': 
// //       case 'f':
// //         return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
// //       case 'promo':
// //       case 'p':
// //         return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
// //       default: 
// //         return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
// //     }
// //   }

// //   // New function to get color-based text styling
// //   const getColorTextStyle = (color?: string) => {
// //     if (!color || color === '') {
// //       return 'text-gray-900 dark:text-gray-100' // Default colors
// //     }
    
// //     switch (color.toLowerCase()) {
// //       case 'red':
// //         return 'text-red-600 dark:text-red-400'
// //       case 'blue':
// //         return 'text-blue-600 dark:text-blue-400'
// //       case 'yellow':
// //         return 'text-yellow-600 dark:text-yellow-400'
// //       default:
// //         return 'text-gray-900 dark:text-gray-100'
// //     }
// //   }

// //   if (!isOpen) return null

// //   return (
// //     <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 md:hidden">
// //       {/* Header */}
// //       <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3">
// //         <div className="flex items-center gap-3">
// //           <button
// //             onClick={onClose}
// //             className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
// //             aria-label="Close search"
// //           >
// //             <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
// //           </button>
          
// //           <form onSubmit={handleSearch} className="flex-1 flex gap-2">
// //             <div className="flex-1 relative">
// //               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
// //               <input
// //                 ref={searchInputRef}
// //                 type="text"
// //                 value={query}
// //                 onChange={(e) => setQuery(e.target.value)}
// //                 placeholder="Search cards..."
// //                 className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-gray-100"
// //               />
// //             </div>
// //             <button
// //               type="submit"
// //               disabled={query.length < 3 || loading}
// //               className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center"
// //             >
// //               {loading ? (
// //                 <Loader2 className="h-5 w-5 animate-spin" />
// //               ) : (
// //                 'Search'
// //               )}
// //             </button>
// //           </form>
// //         </div>
        
// //         {query.length > 0 && query.length < 3 && (
// //           <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
// //             Type at least 3 characters to search
// //           </p>
// //         )}
// //       </div>

// //       {/* Results */}
// //       <div className="overflow-y-auto h-[calc(100vh-73px)]">
// //         {error && (
// //           <div className="p-4 text-center text-red-600 dark:text-red-400">
// //             {error}
// //           </div>
// //         )}

// //         {!loading && hasSearched && query.length >= 3 && results.length === 0 && (
// //           <div className="p-8 text-center">
// //             <p className="text-gray-500 dark:text-gray-400">
// //                 No cards found for "{query.trim()}"
// //             </p>
// //           </div>
// //         )}

// //         {results.length > 0 && (
// //           <div className="px-4 py-2">
// //             {/* Search term header - Apply color styling here */}
// //             <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
// //               <h2 className={`font-semibold text-lg capitalize ${getColorTextStyle(results[0]?.color)}`}>
// //                 {results[0]?.display_name || results[0]?.name || query}
// //               </h2>
// //               <p className="text-sm text-gray-500 dark:text-gray-400">
// //                 {results.length} variant{results.length !== 1 ? 's' : ''} found
// //               </p>
// //             </div>

// //             {/* Results grid */}
// //             <div className="space-y-2">
// //               {results.map((result) => (
// //                 <div
// //                   key={result.printing_id}
// //                   className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
// //                 >
// //                   <div className="flex items-center gap-3 flex-1 min-w-0">
// //                     {/* Card ID */}
// //                     <div className={`font-mono text-sm font-semibold min-w-[60px] ${getColorTextStyle(result.color)}`}>
// //                       {result.printing_card_id}
// //                     </div>
                    
// //                     {/* Edition & Foiling badges */}
// //                     <div className="flex gap-1 flex-wrap">
// //                       {result.foiling && result.foiling !== 's' && (
// //                         <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
// //                           {result.foiling === 'r' ? 'RF' : result.foiling === 'c' ? 'CF' : result.foiling.toUpperCase()}
// //                         </span>
// //                       )}
                      
// //                       {result.edition && result.edition !== 'n' && (
// //                         <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
// //                           {result.edition === 'f' ? '1st' : result.edition === 'u' ? 'Unl' : result.edition.toUpperCase()}
// //                         </span>
// //                       )}
                      
// //                       <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${getRarityBadgeColor(result.rarity)}`}>
// //                         {result.rarity?.charAt(0)?.toUpperCase()}
// //                       </span>
// //                     </div>
// //                   </div>

// //                   {/* Price and Who Has */}
// //                   <div className="flex items-center gap-3">
// //                     <div className="text-right">
// //                       <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
// //                         {formatPrice(result.tcg_low)}
// //                       </div>
// //                     </div>
                    
// //                     {/* Who Has Button - Only show if someone has it */}
// //                     <div className="flex items-center">
// //                       {result.hasOwners ? (
// //                         <div className="relative">
// //                           <MobileWhoHas 
// //                             printingId={result.printing_id}
// //                             cardName={result.display_name || result.name}
// //                             className=""
// //                           />
// //                         </div>
// //                       ) : (
// //                         <div className="p-2 text-gray-300 dark:text-gray-600 opacity-30" title="No one has this card for trade">
// //                           <Users className="w-4 h-4" />
// //                         </div>
// //                       )}
// //                       {/* Debug indicator */}
// //                       <div className="ml-1 text-xs font-mono text-gray-500">
// //                         {result.hasOwners ? '✓' : '✗'}
// //                       </div>
// //                     </div>
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   )
// // }
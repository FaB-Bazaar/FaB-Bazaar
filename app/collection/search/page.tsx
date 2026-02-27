// "use client";

// // --- HOOKS AND UTILITIES ---
// import React, { useState, useEffect } from "react";
// import Link from 'next/link';
// import { useSearchParams } from 'next/navigation';
// import { useAuth } from "@/contexts/AuthContext";
// import { useDebounce } from 'use-debounce';
// import { useInView } from 'react-intersection-observer';

// // --- UI COMPONENTS ---
// import { BinderSearchAndFilters } from "@/components/binder/BinderSearchAndFilters";
// import BinderCard from "@/components/binder/BinderCard"; // Using your main BinderCard
// import { Loader2, BookOpen, AlertCircle } from "lucide-react";
// import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";

// // ============================================================================
// // Helper component to show which binder a card is from
// // ============================================================================
// const CardLocationBadge = ({ binderInfo }: { binderInfo?: { name: string, slug: string } }) => {
//   if (!binderInfo?.slug) return null;
  
//   return (
//     <div className="absolute top-1.5 right-1.5 z-10">
//       <Link href={`/binder/${binderInfo.slug}`} title={`In binder: ${binderInfo.name}`}>
//         <Badge variant="secondary" className="text-xs opacity-80 hover:opacity-100 shadow-md">
//           {binderInfo.name}
//         </Badge>
//       </Link>
//     </div>
//   );
// };

// // ============================================================================
// // MAIN PAGE COMPONENT
// // ============================================================================
// export default function CollectionSearchPage() {
//   const { user } = useAuth();
//   const searchParams = useSearchParams();

//   // --- STATE MANAGEMENT (with safe initial values) ---
//   const [cards, setCards] = useState<any[] | null>(null); // Start as null to represent "not yet fetched"
//   const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCards: 0 });
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [loadingMore, setLoadingMore] = useState(false);
  
//   const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
//   const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
//   const [activeFilters, setActiveFilters] = useState<Record<string, string | null>>({});
//   const [sortBy, setSortBy] = useState("default");
  
//   const [filtersExpanded, setFiltersExpanded] = useState(true);
//   const [uniqueValues, setUniqueValues] = useState({ rarities: [], foilings: [], sets: [], conditions: [] });
//   const [counts, setCounts] = useState({});

//   const { ref: infiniteScrollRef, inView } = useInView({ threshold: 0.5 });

//   // --- DATA FETCHING ---
//   const fetchCards = async (page = 1, shouldReset = false) => {
//     // ... (This function is the same as the last version)
//   };

//   // --- EFFECTS ---
//   useEffect(() => {
//     if (user && debouncedSearchQuery.length >= 3) {
//       fetchCards(1, true);
//     } else if (user) {
//       setCards([]); // Clear cards if query is too short
//       setPagination({ page: 1, totalPages: 1, totalCards: 0 }); // Reset pagination
//       setLoading(false);
//     }
//   }, [user, debouncedSearchQuery, activeFilters, sortBy]);

//   useEffect(() => {
//     // --- THIS IS THE FIX ---
//     // Guard the logic to ensure pagination exists before using it.
//     if (pagination) {
//       const hasMore = pagination.page < pagination.totalPages;
//       if (inView && hasMore && !loading && !loadingMore) {
//         fetchCards(pagination.page + 1);
//       }
//     }
//   }, [inView, loading, loadingMore, pagination]); // Add pagination to dependency array

//   // --- FILTER MANAGEMENT ---
//   const setFilter = (type: string, value: string) => setActiveFilters(prev => ({ ...prev, [type]: value }));
//   const clearFilter = (type: string) => { /* ... */ };
//   const clearAllFilters = () => { /* ... */ };
//   const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

//   // --- RENDER LOGIC ---
//   const renderContent = () => {
//     // State 1: Initial load (cards is null)
//     if (cards === null) {
//       return (
//         <div className="flex flex-col items-center justify-center text-center py-20">
//           <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
//           <p className="text-muted-foreground">Searching your collection...</p>
//         </div>
//       );
//     }

//     // State 2: Error occurred
//     if (error) { /* ... error UI ... */ }

//     // State 3: No results found
//     if (cards.length === 0 && debouncedSearchQuery.length >= 3) { /* ... no results UI ... */ }
    
//     // State 4: Results found
//     if (cards.length > 0) {
//       return (
//         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
//           {cards.map((card) => (
//             <div key={`${card._id}-${card.binderInfo?.slug}` || card.id} className="relative group">
//               {/* You can pass dummy props for actions that don't apply on this page */}
//               <BinderCard 
//                 card={card}
//                 editable={false}
//                 onEdit={() => {}}
//                 onRemove={() => {}}
//                 onQuantityIncrease={() => {}}
//                 onQuantityDecrease={() => {}}
//                 // ... etc.
//               />
//               <CardLocationBadge binderInfo={card.binderInfo} />
//             </div>
//           ))}
//         </div>
//       );
//     }
    
//     // Default state (e.g., query too short)
//     return null;
//   };

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-2">Collection Search</h1>
//       <p className="text-muted-foreground mb-6">
//         Search for cards across all of your binders.
//       </p>

//       <BinderSearchAndFilters
//         // ... (all props are the same)
//       />
      
//       {renderContent()}

//       <div ref={infiniteScrollRef} className="h-10 flex justify-center items-center mt-4">
//         {loadingMore && <Loader2 className="h-6 w-6 animate-spin" />}
//       </div>
//     </div>
//   );
// }
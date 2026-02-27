// components/deck/DeckPrintingsGrid.tsx - Enhanced visual grid for deck printings
"use client"

import React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import DeckPrintingCard from "./DeckPrintingCard"
import StackedCardGroup from "./StackedCardGroup"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;  // ✅ ADDED: Quantity of this printing
  // Removed category field - now inferred from context
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
}

interface CardGroup {
  cardName: string;
  cardId: string;
  category: "hero" | "equipment" | "maindeck" | "inventory"; // Updated categories
  printings: (DeckPrinting & { category: string })[];
}

interface DeckPrintingsGridProps {
  printings: (DeckPrinting & { category: string })[];
  groupedCards: Record<string, CardGroup>;
  category: "hero" | "equipment" | "maindeck" | "inventory";
  editable: boolean;
  viewMode: "grouped" | "individual" | "compact";
  stackGrouping?: "by-name" | "by-printing"; // For compact view stacking behavior
  ownershipStatus?: Map<string, any>; // Ownership data for indicators
  onRemove: (printing: DeckPrinting & { category: string }) => void;
  onAddAnother: (printing: DeckPrinting & { category: string }) => void;
  onMove?: (printing: DeckPrinting & { category: string }) => void;
  onOpenPrintingSwap?: (printing: DeckPrinting & { category: string }) => void;
  onAddCard: () => void;
  SortablePrintingCard: React.ComponentType<{
    printing: DeckPrinting & { category: string };
    children: React.ReactNode;
  }>;
  removingCards?: Set<string>; // Animation support
  movingCards?: Set<string>; // Moving cards state
  // New props for compact view action buttons
  onAddToWants?: (printing: DeckPrinting & { category: string }) => void;
  onAddToBinder?: (printing: DeckPrinting & { category: string }) => void;
  wantsMap?: Map<string, number>;
  binderMap?: Map<string, { quantity: number; cardId: string }>;
  deckCardCounts?: Map<string, number>;
}

export default function DeckPrintingsGrid({
  printings,
  groupedCards,
  category,
  editable,
  viewMode,
  stackGrouping = "by-name",
  ownershipStatus,
  onRemove,
  onAddAnother,
  onMove,
  onOpenPrintingSwap,
  onAddCard,
  SortablePrintingCard,
  removingCards,
  movingCards,
  onAddToWants,
  onAddToBinder,
  wantsMap,
  binderMap,
  deckCardCounts
}: DeckPrintingsGridProps) {
  const [hoveredGroupId, setHoveredGroupId] = React.useState<string | null>(null);

  // Filter printings for this category
  const categoryPrintings = printings.filter(p => p.category === category);
  const categoryGroups = Object.values(groupedCards).filter(g => g.category === category);

  // ✅ EXPAND printings based on quantity (for compact/individual views to show each copy separately)
  const expandedCategoryPrintings = React.useMemo(() => {
    const expanded: (DeckPrinting & { category: string })[] = [];
    categoryPrintings.forEach((printing) => {
      const qty = printing.quantity || 1;

      // 🔍 LOG: Show expansion
      if (category === 'equipment' && qty > 1) {
        console.log('[DeckPrintingsGrid] Expanding:', {
          name: printing.printingDetails?.name,
          originalQty: qty,
          willCreate: qty + ' copies'
        });
      }

      // Create separate entries for each copy
      for (let i = 0; i < qty; i++) {
        expanded.push({
          ...printing,
          // Remove quantity from individual copies since each represents 1 card now
          quantity: 1
        });
      }
    });

    // 🔍 LOG: Compare sizes
    if (category === 'equipment') {
      console.log('[DeckPrintingsGrid] Expansion result:', {
        originalCount: categoryPrintings.length,
        expandedCount: expanded.length
      });
    }

    return expanded;
  }, [categoryPrintings, category]);

  // ✅ Calculate total cards using quantities instead of array length
  const totalCategoryCards = categoryPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0);

  // Group cards for compact stacked view based on stackGrouping mode
  // Create a hash of printings to detect changes in printing details (for swaps)
  const printingsHash = React.useMemo(() => {
    return categoryPrintings.map(p =>
      `${p._id || p.printingId}-${p.printingDetails?.foiling}-${p.printingDetails?.edition}-${p.printingDetails?.set_id}`
    ).join('|');
  }, [categoryPrintings]);

  const stackedGroups = React.useMemo(() => {
    if (viewMode !== "compact") return categoryGroups;

    if (stackGrouping === "by-name") {
      // Group by base card name only (ignores color/pitch)
      const grouped: Record<string, CardGroup> = {};
      // ✅ Use expanded printings so each copy shows separately
      expandedCategoryPrintings.forEach((printing) => {
        const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'Unknown';
        // Use only the base card name as the key (strip color/pitch)
        const key = `${category}-${cardName}`;

        if (!grouped[key]) {
          grouped[key] = {
            cardName: cardName,
            cardId: key,
            category: category,
            printings: []
          };
        }
        grouped[key].printings.push(printing);
      });

      // 🔍 LOG: Check grouped results
      const result = Object.values(grouped);
      if (category === 'equipment') {
        console.log('[DeckPrintingsGrid] Grouped (by-name):',
          result.map(g => ({
            name: g.cardName,
            printingsCount: g.printings.length
          }))
        );
      }

      return result;
    }

    if (stackGrouping === "by-printing") {
      // Group by exact printing (edition + foiling + set)
      const grouped: Record<string, CardGroup> = {};
      // ✅ Use expanded printings so each copy shows separately
      expandedCategoryPrintings.forEach((printing) => {
        const edition = printing.printingDetails?.edition || 'N';
        const foiling = printing.printingDetails?.foiling || 'S';
        const setId = printing.printingDetails?.set_id || 'unknown';
        const cardId = printing.printingDetails?.card_unique_id || printing.printingId;
        const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'Unknown';

        const key = `${category}-${cardId}-${edition}-${foiling}-${setId}`;

        if (!grouped[key]) {
          grouped[key] = {
            cardName: `${cardName} (${edition}-${foiling})`,
            cardId: key,
            category: category,
            printings: []
          };
        }
        grouped[key].printings.push(printing);
      });
      return Object.values(grouped);
    }

    // Fallback: use existing category groups
    return categoryGroups;
  }, [viewMode, stackGrouping, categoryPrintings, categoryGroups, category, printingsHash]);

  // Generate unique key for each printing - this is the fix for duplicate keys
  const generateUniqueKey = (printing: DeckPrinting & { category: string }, index: number) => {
    // Priority: _id > printingId + index > fallback with index
    if (printing._id) {
      return printing._id;
    }
    return `${printing.printingId}-${index}-${category}`;
  };

  // Get category display name - updated for new categories
  const getCategoryDisplayName = (cat: string) => {
    const names = {
      'hero': 'Hero',
      'equipment': 'Equipment',
      'maindeck': 'Main Deck',
      'inventory': 'Inventory',
      'maybeboard': 'Maybeboard',
      'tokens': 'Tokens'
    };
    return names[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  // Grouped Card Component
  const CardGroupComponent = ({ group }: { group: CardGroup }) => {
    // ✅ Sum quantities instead of counting array length
    const totalQuantity = group.printings.reduce((sum, p) => sum + (p.quantity || 1), 0);

    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{group.cardName}</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400">{totalQuantity}x</div>
          </div>
          {editable && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onAddCard}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {group.printings.map((printing, index) => {
            const uniqueKey = generateUniqueKey(printing, index);
            return (
              <SortablePrintingCard key={uniqueKey} printing={printing}>
                <DeckPrintingCard
                  printing={printing}
                  category={category}
                  editable={editable}
                  isGrouped={true}
                  onRemove={onRemove}
                  onAddAnother={onAddAnother}
                  onMove={onMove}
                  onOpenPrintingSwap={onOpenPrintingSwap}
                  isRemoving={removingCards?.has(printing._id || printing.printingId)}
                  isMoving={movingCards?.has(`${printing.printingId}-${printing.category}`)}
                />
              </SortablePrintingCard>
            );
          })}
        </div>
      </div>
    );
  };

  // Generate robust printingIds for sortable context
  const printingIds = categoryPrintings.map((p, index) => generateUniqueKey(p, index));
  
  // Updated droppable categories
  const isDroppable = (category === "maindeck" || category === "inventory") && editable;

  return (
    <SortableContext 
      items={printingIds} 
      strategy={verticalListSortingStrategy} 
      id={category} 
      disabled={!isDroppable}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Category Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {getCategoryDisplayName(category)}
            <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
              {totalCategoryCards} cards • {categoryGroups.length} unique
            </span>
          </h3>
          {editable && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onAddCard}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Content */}
        {categoryPrintings.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-lg mb-2">No {getCategoryDisplayName(category).toLowerCase()} cards</div>
            <div className="text-sm">
              {editable ? `Click "Add" to add ${getCategoryDisplayName(category).toLowerCase()} cards to your deck` : `This deck has no ${getCategoryDisplayName(category).toLowerCase()} cards`}
            </div>
          </div>
        ) : viewMode === "grouped" ? (
          <div className="space-y-4">
            {categoryGroups.map((group) => (
              <CardGroupComponent
                key={`${group.category}-${group.cardId}`}
                group={group}
              />
            ))}
          </div>
        ) : viewMode === "compact" ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {stackedGroups.map((group) => {
              const groupKey = `${group.category}-${group.cardId}`;
              const isHovered = hoveredGroupId === groupKey;
              const shouldDim = hoveredGroupId !== null && !isHovered;

              // Create a unique key that includes printing details to force re-render on swap
              const printingsKey = group.printings.map(p =>
                `${p._id || p.printingId}-${p.printingDetails?.foiling}-${p.printingDetails?.edition}`
              ).join('|');
              const uniqueGroupKey = `${groupKey}-${printingsKey}`;

              return (
                <div
                  key={uniqueGroupKey}
                  className={`transition-opacity duration-300 ${shouldDim ? 'opacity-40' : 'opacity-100'}`}
                  onMouseEnter={() => setHoveredGroupId(groupKey)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                >
                  <StackedCardGroup
                    group={group}
                    ownershipStatus={ownershipStatus}
                    onSwapPrinting={onOpenPrintingSwap}
                    onAddToWants={onAddToWants}
                    onAddToBinder={onAddToBinder}
                    onMove={onMove}
                    onRemove={onRemove}
                    onAddAnother={onAddAnother}
                    wantsMap={wantsMap}
                    binderMap={binderMap}
                    deckCardCounts={deckCardCounts}
                    editable={editable}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
            {/* ✅ Use expanded printings to show each copy separately */}
            {expandedCategoryPrintings.map((printing, index) => {
              const uniqueKey = generateUniqueKey(printing, index);

              // Smart grouping: find how many copies of this card exist
              const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name;
              // ✅ Use expanded printings (already 1 per card) for counting
              const sameCards = expandedCategoryPrintings.filter(p =>
                (p.printingDetails?.display_name || p.printingDetails?.name) === cardName
              );
              const cardCount = sameCards.length; // Each entry is already 1 card
              const cardPosition = sameCards.findIndex((p, idx) =>
                p.printingId === printing.printingId && idx === index
              ) + 1;

              // Color for visual grouping
              const groupColors = [
                'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30',
                'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/30',
                'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30',
                'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30',
                'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800/30'
              ];
              const groupColorIndex = cardName ? cardName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % groupColors.length : 0;
              const groupBg = cardCount > 1 ? groupColors[groupColorIndex] : '';

              return (
                <div key={uniqueKey} className={`relative rounded-lg transition-all ${groupBg} ${cardCount > 1 ? 'p-1' : ''}`}>
                  <SortablePrintingCard printing={printing}>
                    <DeckPrintingCard
                      printing={{...printing, category}}
                      category={category}
                      editable={editable}
                      isGrouped={false}
                    onRemove={onRemove}
                    onAddAnother={onAddAnother}
                    onMove={onMove}
                    onOpenPrintingSwap={onOpenPrintingSwap}
                    isRemoving={removingCards?.has(printing._id || printing.printingId)}
                    isMoving={movingCards?.has(`${printing.printingId}-${category}`)}
                  />
                  </SortablePrintingCard>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SortableContext>
  );
}

// // components/deck/DeckPrintingsGrid.tsx - Enhanced visual grid for deck printings
// "use client"

// import React from "react"
// import { Plus } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import DeckPrintingCard from "./DeckPrintingCard"
// import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

// interface DeckPrinting {
//   _id?: string;
//   printingId: string;
//   // Removed category field - now inferred from context
//   condition?: string;
//   notes?: string;
//   addedAt: string;
//   isOptimistic?: boolean;
//   printingDetails?: { [key: string]: any };
// }

// interface CardGroup {
//   cardName: string;
//   cardId: string;
//   category: "hero" | "equipment" | "maindeck" | "inventory"; // Updated categories
//   printings: (DeckPrinting & { category: string })[];
// }

// interface DeckPrintingsGridProps {
//     printings: (DeckPrinting & { category: string })[];
//     groupedCards: Record<string, CardGroup>;
//     category: "hero" | "equipment" | "maindeck" | "inventory";
//     editable: boolean;
//     viewMode: "grouped" | "individual";
//     onEdit: (printing: DeckPrinting & { category: string }) => void;
//     onRemove: (printing: DeckPrinting & { category: string }) => void;
//     onAddAnother: (printing: DeckPrinting & { category: string }) => void;
//     onMove?: (printing: DeckPrinting & { category: string }) => void;
//     onOpenPrintingSwap?: (printing: DeckPrinting & { category: string }) => void;
//     onAddCard: () => void;
//     SortablePrintingCard: React.ComponentType<{
//       printing: DeckPrinting & { category: string };
//       children: React.ReactNode;
//     }>;
//     removingCards?: Set<string>; // Add this line
//   }

//   export default function DeckPrintingsGrid({
//     printings,
//     groupedCards,
//     category,
//     editable,
//     viewMode,
//     onEdit,
//     onRemove,
//     onAddAnother,
//     onMove,
//     onOpenPrintingSwap,
//     onAddCard,
//     SortablePrintingCard,
//     removingCards // Add this line
//   }: DeckPrintingsGridProps) {

//   // Filter printings for this category
//   const categoryPrintings = printings.filter(p => p.category === category);
//   const categoryGroups = Object.values(groupedCards).filter(g => g.category === category);

//   // Generate unique key for each printing - this is the fix for duplicate keys
//   const generateUniqueKey = (printing: DeckPrinting & { category: string }, index: number) => {
//     // Priority: _id > printingId + index > fallback with index
//     if (printing._id) {
//       return printing._id;
//     }
//     return `${printing.printingId}-${index}-${category}`;
//   };

//   // Get category display name - updated for new categories
//   const getCategoryDisplayName = (cat: string) => {
//     const names = {
//       'hero': 'Hero',
//       'equipment': 'Equipment',
//       'maindeck': 'Main Deck',
//       'inventory': 'Inventory',
//       'maybeboard': 'Maybeboard',
//       'tokens': 'Tokens'
//     };
//     return names[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
//   };

//   // Grouped Card Component
//   const CardGroupComponent = ({ group }: { group: CardGroup }) => {
//     return (
//       <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
//         <div className="flex items-center justify-between mb-3">
//           <div>
//             <h4 className="font-semibold text-gray-900 dark:text-gray-100">{group.cardName}</h4>
//             <div className="text-sm text-gray-600 dark:text-gray-400">{group.printings.length}x</div>
//           </div>
//           {editable && (
//             <Button 
//               size="sm" 
//               variant="outline" 
//               onClick={onAddCard}
//               className="text-xs"
//             >
//               <Plus className="h-3 w-3 mr-1" />
//               Add
//             </Button>
//           )}
//         </div>
//         <div className="flex gap-3 overflow-x-auto pb-2">
//           {group.printings.map((printing, index) => {
//             const uniqueKey = generateUniqueKey(printing, index);
//             return (
//               <SortablePrintingCard key={uniqueKey} printing={printing}>
//                 <DeckPrintingCard
//                     printing={printing}
//                     category={category}
//                     editable={editable}
//                     isGrouped={false}
//                     onEdit={onEdit}
//                     onRemove={onRemove}
//                     onAddAnother={onAddAnother}
//                     onMove={onMove}
//                     onOpenPrintingSwap={onOpenPrintingSwap}
//                     isRemoving={removingCards?.has(printing._id || printing.printingId)} // Add this line
//                     />
//               </SortablePrintingCard>
//             );
//           })}
//         </div>
//       </div>
//     );
//   };

//   // Generate robust printingIds for sortable context
//   const printingIds = categoryPrintings.map((p, index) => generateUniqueKey(p, index));
  
//   // Updated droppable categories
//   const isDroppable = (category === "maindeck" || category === "inventory") && editable;

//   return (
//     <SortableContext 
//       items={printingIds} 
//       strategy={verticalListSortingStrategy} 
//       id={category} 
//       disabled={!isDroppable}
//     >
//       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
//         {/* Category Header */}
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
//             {getCategoryDisplayName(category)} ({categoryPrintings.length} cards)
//           </h3>
//           {editable && (
//             <Button 
//               size="sm" 
//               variant="outline" 
//               onClick={onAddCard}
//             >
//               <Plus className="h-4 w-4 mr-1" />
//               Add
//             </Button>
//           )}
//         </div>

//         {/* Content */}
//         {categoryPrintings.length === 0 ? (
//           <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//             <div className="text-lg mb-2">No {getCategoryDisplayName(category).toLowerCase()} cards</div>
//             <div className="text-sm">
//               {editable ? `Click "Add" to add ${getCategoryDisplayName(category).toLowerCase()} cards to your deck` : `This deck has no ${getCategoryDisplayName(category).toLowerCase()} cards`}
//             </div>
//           </div>
//         ) : viewMode === "grouped" ? (
//           <div className="space-y-4">
//             {categoryGroups.map((group) => (
//               <CardGroupComponent 
//                 key={`${group.category}-${group.cardId}`} 
//                 group={group} 
//               />
//             ))}
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//             {categoryPrintings.map((printing, index) => {
//               const uniqueKey = generateUniqueKey(printing, index);
//               return (
//                 <SortablePrintingCard key={uniqueKey} printing={printing}>
//                   <DeckPrintingCard
//                     printing={{...printing, category}} 
//                     category={category} 
//                     editable={editable}
//                     isGrouped={viewMode === "grouped"}
//                     onEdit={onEdit}
//                     onRemove={onRemove}
//                     onAddAnother={onAddAnother}
//                     onMove={onMove}
//                     onOpenPrintingSwap={onOpenPrintingSwap}
//                     isRemoving={removingCards?.has(printing._id || printing.printingId)} // Add this line
//                     />
//                 </SortablePrintingCard>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </SortableContext>
//   );
// }
// // components/deck/DeckPrintingsGrid.tsx - Enhanced visual grid for deck printings
// "use client"

// import React from "react"
// import { Plus } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import DeckPrintingCard from "./DeckPrintingCard"
// import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

// interface DeckPrinting {
//   _id?: string;
//   printingId: string;
//   // Removed category field - now inferred from context
//   condition?: string;
//   notes?: string;
//   addedAt: string;
//   isOptimistic?: boolean;
//   printingDetails?: { [key: string]: any };
// }

// interface CardGroup {
//   cardName: string;
//   cardId: string;
//   category: "hero" | "equipment" | "maindeck" | "inventory"; // Updated categories
//   printings: (DeckPrinting & { category: string })[];
// }

// interface DeckPrintingsGridProps {
//   printings: (DeckPrinting & { category: string })[];
//   groupedCards: Record<string, CardGroup>;
//   category: "hero" | "equipment" | "maindeck" | "inventory"; // Updated categories
//   editable: boolean;
//   viewMode: "grouped" | "individual";
//   onEdit: (printing: DeckPrinting & { category: string }) => void;
//   onRemove: (printing: DeckPrinting & { category: string }) => void;
//   onAddAnother: (printing: DeckPrinting & { category: string }) => void;
//   onMove?: (printing: DeckPrinting & { category: string }) => void;
//   onOpenPrintingSwap?: (printing: DeckPrinting & { category: string }) => void;
//   onAddCard: () => void;
//   // Sortable component to wrap printings
//   SortablePrintingCard: React.ComponentType<{
//     printing: DeckPrinting & { category: string };
//     children: React.ReactNode;
//   }>;
// }

// export default function DeckPrintingsGrid({
//   printings,
//   groupedCards,
//   category,
//   editable,
//   viewMode,
//   onEdit,
//   onRemove,
//   onAddAnother,
//   onMove,
//   onOpenPrintingSwap,
//   onAddCard,
//   SortablePrintingCard
// }: DeckPrintingsGridProps) {

//   // Filter printings for this category
//   const categoryPrintings = printings.filter(p => p.category === category);
//   const categoryGroups = Object.values(groupedCards).filter(g => g.category === category);

//   // Get category display name - updated for new categories
//   const getCategoryDisplayName = (cat: string) => {
//     const names = {
//       'hero': 'Hero',
//       'equipment': 'Equipment',
//       'maindeck': 'Main Deck',
//       'inventory': 'Inventory',
//       'maybeboard': 'Maybeboard',
//       'tokens': 'Tokens'
//     };
//     return names[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
//   };

//   // Grouped Card Component
//   const CardGroupComponent = ({ group }: { group: CardGroup }) => {
//     return (
//       <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
//         <div className="flex items-center justify-between mb-3">
//           <div>
//             <h4 className="font-semibold text-gray-900 dark:text-gray-100">{group.cardName}</h4>
//             <div className="text-sm text-gray-600 dark:text-gray-400">{group.printings.length}x</div>
//           </div>
//           {editable && (
//             <Button 
//               size="sm" 
//               variant="outline" 
//               onClick={onAddCard}
//               className="text-xs"
//             >
//               <Plus className="h-3 w-3 mr-1" />
//               Add
//             </Button>
//           )}
//         </div>
//         <div className="flex gap-3 overflow-x-auto pb-2">
//           {group.printings.map((printing) => (
//             <SortablePrintingCard key={printing._id} printing={printing}>
//               <DeckPrintingCard
//                 printing={printing}
//                 category={category} // Pass category as prop
//                 editable={editable}
//                 isGrouped={true}
//                 onEdit={onEdit}
//                 onRemove={onRemove}
//                 onAddAnother={onAddAnother}
//                 onMove={onMove}
//                 onOpenPrintingSwap={onOpenPrintingSwap}
//               />
//             </SortablePrintingCard>
//           ))}
//         </div>
//       </div>
//     );
//   };

//   // Get printingIds for sortable context
//   const printingIds = categoryPrintings.map(p => p._id!).filter(Boolean);
//   // Updated droppable categories
//   const isDroppable = (category === "maindeck" || category === "inventory") && editable;

//   return (
//     <SortableContext 
//       items={printingIds} 
//       strategy={verticalListSortingStrategy} 
//       id={category} 
//       disabled={!isDroppable}
//     >
//       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
//         {/* Category Header */}
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
//             {getCategoryDisplayName(category)} ({categoryPrintings.length} cards)
//           </h3>
//           {editable && (
//             <Button 
//               size="sm" 
//               variant="outline" 
//               onClick={onAddCard}
//             >
//               <Plus className="h-4 w-4 mr-1" />
//               Add
//             </Button>
//           )}
//         </div>

//         {/* Content */}
//         {categoryPrintings.length === 0 ? (
//           <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//             <div className="text-lg mb-2">No {getCategoryDisplayName(category).toLowerCase()} cards</div>
//             <div className="text-sm">
//               {editable ? `Click "Add" to add ${getCategoryDisplayName(category).toLowerCase()} cards to your deck` : `This deck has no ${getCategoryDisplayName(category).toLowerCase()} cards`}
//             </div>
//           </div>
//         ) : viewMode === "grouped" ? (
//           <div className="space-y-4">
//             {categoryGroups.map((group) => (
//               <CardGroupComponent 
//                 key={`${group.category}-${group.cardId}`} 
//                 group={group} 
//               />
//             ))}
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//             {categoryPrintings.map((printing) => (
//               <SortablePrintingCard key={printing._id} printing={printing}>
//                 <DeckPrintingCard
//                   printing={printing}
//                   category={category} // Pass category as prop
//                   editable={editable}
//                   isGrouped={false}
//                   onEdit={onEdit}
//                   onRemove={onRemove}
//                   onAddAnother={onAddAnother}
//                   onMove={onMove}
//                   onOpenPrintingSwap={onOpenPrintingSwap}
//                 />
//               </SortablePrintingCard>
//             ))}
//           </div>
//         )}
//       </div>
//     </SortableContext>
//   );
// }
// // // components/deck/DeckPrintingsGrid.tsx - Enhanced visual grid for deck printings
// // "use client"

// // import React from "react"
// // import { Plus } from "lucide-react"
// // import { Button } from "@/components/ui/button"
// // import DeckPrintingCard from "./DeckPrintingCard"
// // import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"


// // interface DeckPrinting {
// //   _id?: string;
// //   printingId: string;
// //   category: "hero" | "equipment" | "main" | "sideboard";
// //   condition?: string;
// //   notes?: string;
// //   addedAt: string;
// //   isOptimistic?: boolean;
// //   printingDetails?: { [key: string]: any };
// // }

// // interface CardGroup {
// //   cardName: string;
// //   cardId: string;
// //   category: "hero" | "equipment" | "main" | "sideboard";
// //   printings: DeckPrinting[];
// // }

// // interface DeckPrintingsGridProps {
// //   printings: DeckPrinting[];
// //   groupedCards: Record<string, CardGroup>;
// //   category: "hero" | "equipment" | "main" | "sideboard";
// //   editable: boolean;
// //   viewMode: "grouped" | "individual";
// //   onEdit: (printing: DeckPrinting) => void;
// //   onRemove: (printing: DeckPrinting) => void;
// //   onAddAnother: (printing: DeckPrinting) => void;
// //   onMove?: (printing: DeckPrinting) => void;
// //   onOpenPrintingSwap?: (printing: DeckPrinting) => void;
// //   onAddCard: () => void;
// //   // Sortable component to wrap printings
// //   SortablePrintingCard: React.ComponentType<{
// //     printing: DeckPrinting;
// //     children: React.ReactNode;
// //   }>;
// // }

// // export default function DeckPrintingsGrid({
// //   printings,
// //   groupedCards,
// //   category,
// //   editable,
// //   viewMode,
// //   onEdit,
// //   onRemove,
// //   onAddAnother,
// //   onMove,
// //   onOpenPrintingSwap,
// //   onAddCard,
// //   SortablePrintingCard
// // }: DeckPrintingsGridProps) {

// //   // Filter printings for this category
// //   const categoryPrintings = printings.filter(p => p.category === category);
// //   const categoryGroups = Object.values(groupedCards).filter(g => g.category === category);

// //   // Get category display name
// //   const getCategoryDisplayName = (cat: string) => {
// //     return cat.charAt(0).toUpperCase() + cat.slice(1);
// //   };

// //   // Grouped Card Component
// //   const CardGroupComponent = ({ group }: { group: CardGroup }) => {
// //     return (
// //       <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
// //         <div className="flex items-center justify-between mb-3">
// //           <div>
// //             <h4 className="font-semibold text-gray-900 dark:text-gray-100">{group.cardName}</h4>
// //             <div className="text-sm text-gray-600 dark:text-gray-400">{group.printings.length}x</div>
// //           </div>
// //           {editable && (
// //             <Button 
// //               size="sm" 
// //               variant="outline" 
// //               onClick={onAddCard}
// //               className="text-xs"
// //             >
// //               <Plus className="h-3 w-3 mr-1" />
// //               Add
// //             </Button>
// //           )}
// //         </div>
// //         <div className="flex gap-3 overflow-x-auto pb-2">
// //           {group.printings.map((printing) => (
// //             <SortablePrintingCard key={printing._id} printing={printing}>
// //               <DeckPrintingCard
// //                 printing={printing}
// //                 editable={editable}
// //                 isGrouped={true}
// //                 onEdit={onEdit}
// //                 onRemove={onRemove}
// //                 onAddAnother={onAddAnother}
// //                 onMove={onMove}
// //                 onOpenPrintingSwap={onOpenPrintingSwap}
// //               />
// //             </SortablePrintingCard>
// //           ))}
// //         </div>
// //       </div>
// //     );
// //   };

// //   // Get printingIds for sortable context
// //   const printingIds = categoryPrintings.map(p => p._id!).filter(Boolean);
// //   const isDroppable = (category === "main" || category === "sideboard") && editable;

// //   return (
// //     <SortableContext 
// //       items={printingIds} 
// //       strategy={verticalListSortingStrategy} 
// //       id={category} 
// //       disabled={!isDroppable}
// //     >
// //       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
// //         {/* Category Header */}
// //         <div className="flex items-center justify-between mb-4">
// //           <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
// //             {getCategoryDisplayName(category)} ({categoryPrintings.length} cards)
// //           </h3>
// //           {editable && (
// //             <Button 
// //               size="sm" 
// //               variant="outline" 
// //               onClick={onAddCard}
// //             >
// //               <Plus className="h-4 w-4 mr-1" />
// //               Add
// //             </Button>
// //           )}
// //         </div>

// //         {/* Content */}
// //         {categoryPrintings.length === 0 ? (
// //           <div className="text-center py-8 text-gray-500 dark:text-gray-400">
// //             <div className="text-lg mb-2">No {category} cards</div>
// //             <div className="text-sm">
// //               {editable ? `Click "Add" to add ${category} cards to your deck` : `This deck has no ${category} cards`}
// //             </div>
// //           </div>
// //         ) : viewMode === "grouped" ? (
// //           <div className="space-y-4">
// //             {categoryGroups.map((group) => (
// //               <CardGroupComponent 
// //                 key={`${group.category}-${group.cardId}`} 
// //                 group={group} 
// //               />
// //             ))}
// //           </div>
// //         ) : (
// //           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// //             {categoryPrintings.map((printing) => (
// //               <SortablePrintingCard key={printing._id} printing={printing}>
// //                 <DeckPrintingCard
// //                   printing={printing}
// //                   editable={editable}
// //                   isGrouped={false}
// //                   onEdit={onEdit}
// //                   onRemove={onRemove}
// //                   onAddAnother={onAddAnother}
// //                   onMove={onMove}
// //                   onOpenPrintingSwap={onOpenPrintingSwap}
// //                 />
// //               </SortablePrintingCard>
// //             ))}
// //           </div>
// //         )}
// //       </div>
// //     </SortableContext>
// //   );
// // }
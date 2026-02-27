// components/binder/SelectedCardsSidebar.tsx

"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, X, ArrowRight, Copy, Check, Package, ChevronRight, Trash2 } from "lucide-react"

// --- TYPES (Remain the same) ---
interface SelectedCardsSidebarProps {
  selectedCards: any[]
  sidebarOpen: boolean
  onCloseSidebar: () => void
  onQuantityChange: (cardId: string, newQuantity: number) => void
  onRemoveSelected: (index: number) => void // Note: onRemoveSelectedCard in parent is better
  onClearSelected: () => void
  onDeleteSelected?: () => void  
  onTransfer?: () => void
  onCopySelected: () => void
  copied: boolean
  editable: boolean
}

export default function SelectedCardsSidebar({
  selectedCards,
  sidebarOpen,
  onCloseSidebar,
  onQuantityChange,
  onRemoveSelected, // This is passed the index, which is fine
  onClearSelected,
  onTransfer,
  onDeleteSelected,
  onCopySelected,
  copied,
  editable
}: SelectedCardsSidebarProps) {

  if (selectedCards.length === 0 && !sidebarOpen) {
    return null
  }

  const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0);

  return (
    <>
      {/* Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
          onClick={onCloseSidebar}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ maxWidth: '100vw' }}
      >
        <div className="flex flex-col h-full">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {selectedCards.length > 0 ? (
                <>
                  <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
                    {selectedCards.length}
                  </Badge>
                  Selected Cards
                </>
              ) : ( "Selected Cards" )}
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCloseSidebar} 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-md border border-gray-300 dark:border-gray-500 flex items-center gap-1"
              title="Hide sidebar"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="text-xs font-medium">Hide</span>
            </Button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-auto">
            {selectedCards.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
                <p className="text-sm">Click on cards to add them to your selection</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {selectedCards.map((card, idx) => (
                  // --- THE KEY LOGIC IS UPDATED HERE ---
                  // The component now reads directly from the flat `card` object.
                  <div 
                    key={card.id || card._id} // Use the unique DB id as the key
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                  >
                    {/* Card Info Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
                          {card.display_name}
                        </p>
                        
                        {/* Card Details Badges (now reads flat properties) */}
                        <div className="flex flex-wrap gap-1">
                          {card.set && (
                            <Badge variant="outline" className="text-xs">{card.set.toUpperCase()}</Badge>
                          )}
                          {card.rarity && (
                            <Badge variant="outline" className="text-xs">{card.rarity.toUpperCase()}</Badge>
                          )}
                          {card.foiling && (
                            <Badge variant="outline" className="text-xs">{card.foiling.toUpperCase()}</Badge>
                          )}
                          {card.condition && card.condition !== 'NM' && (
                            <Badge variant="outline" className="text-xs">{card.condition}</Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Remove Button */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300" 
                        onClick={() => onRemoveSelected(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => onQuantityChange(card.id, card.quantity - 1)}
                        disabled={card.quantity <= 1}
                      >
                        -
                      </Button>
                      <div className="flex flex-col items-center min-w-[3rem]">
                        <span className="font-mono text-sm font-medium">
                          {card.quantity}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          of {card.maxQuantity}
                        </span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => onQuantityChange(card.id, card.quantity + 1)}
                        disabled={card.quantity >= card.maxQuantity}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer Actions */}
          {selectedCards.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
              {/* Summary */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Selected:</span>
                  <span className="text-sm font-bold">{selectedCards.length} cards</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total quantity:</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{totalCards}</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {editable && onTransfer && (
                  <Button className="w-full" onClick={onTransfer} disabled={selectedCards.length === 0}>
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Transfer to Binder
                  </Button>
                )}
                <div className="flex gap-2">
                  {editable && onDeleteSelected && (
                    <Button variant="outline" className="flex-1" onClick={onDeleteSelected} disabled={selectedCards.length === 0}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" onClick={onClearSelected} disabled={selectedCards.length === 0} className="flex-1">
                    Clear All
                  </Button>
                </div>
                {!editable && (
                  <Button className="w-full" onClick={onCopySelected} disabled={selectedCards.length === 0}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? 'Copied!' : 'Copy List'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// //components/binder/SelectedCardsSidebar.tsx

// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { ShoppingCart, X, ArrowRight, Copy, Check, Package, ChevronRight, Trash2 } from "lucide-react"


// // Types
// interface SelectedCardsSidebarProps {
//   selectedCards: any[]
//   sidebarOpen: boolean
//   onCloseSidebar: () => void
//   onQuantityChange: (cardId: string, newQuantity: number) => void
//   onRemoveSelected: (index: number) => void
//   onClearSelected: () => void
//   onDeleteSelected?: () => void  
//   onTransfer?: () => void
//   onCopySelected: () => void
//   copied: boolean
//   editable: boolean
// }

// export default function SelectedCardsSidebar({
//   selectedCards,
//   sidebarOpen,
//   onCloseSidebar,
//   onQuantityChange,
//   onRemoveSelected,
//   onClearSelected,
//   onTransfer,
//   onDeleteSelected,
//   onCopySelected,
//   copied,
//   editable
// }: SelectedCardsSidebarProps) {

//   // Don't render if no cards and sidebar is closed
//   if (selectedCards.length === 0 && !sidebarOpen) {
//     return null
//   }

//   const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0);

//   return (
//     <>
//       {/* Backdrop */}
//       {sidebarOpen && (
//         <div 
//           className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
//           onClick={onCloseSidebar}
//         />
//       )}
      
//       {/* Sidebar */}
//       <div
//         className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
//           sidebarOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//         style={{ maxWidth: '100vw' }}
//       >
//         <div className="flex flex-col h-full">
          
//           {/* Header */}
//           <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
//             <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
//               <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
//               {selectedCards.length > 0 ? (
//                 <>
//                   <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
//                     {selectedCards.length}
//                   </Badge>
//                   Selected Cards
//                 </>
//               ) : (
//                 "Selected Cards"
//               )}
//             </h2>
//             <Button 
//               variant="ghost" 
//               size="sm" 
//               onClick={onCloseSidebar} 
//               className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-md border border-gray-300 dark:border-gray-500 flex items-center gap-1"
//               title="Hide sidebar"
//             >
//               <ChevronRight className="h-4 w-4" />
//               <span className="text-xs font-medium">Hide</span>
//             </Button>
//           </div>
          
//           {/* Content */}
//           <div className="flex-1 overflow-auto">
//             {selectedCards.length === 0 ? (
//               <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
//                 <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                 <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
//                 <p className="text-sm">Click on cards to add them to your selection</p>
//               </div>
//             ) : (
//               <div className="p-4 space-y-3">
//                 {selectedCards.map((card, idx) => (
//                   <div 
//                     key={card.id + '|' + card.printingId} 
//                     className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
//                   >
//                     {/* Card Info Header */}
//                     <div className="flex justify-between items-start mb-3">
//                       <div className="flex-1 pr-2">
//                         <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
//                           {card.name || card.display_name}
//                         </p>
                        
//                         {/* Card Details Badges */}
//                         <div className="flex flex-wrap gap-1">
//                           {card.set && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.set}
//                             </Badge>
//                           )}
//                           {card.rarity && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.rarity}
//                             </Badge>
//                           )}
//                           {card.foiling && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.foiling}
//                             </Badge>
//                           )}
//                           {card.condition && card.condition !== 'NM' && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30"
//                             >
//                               {card.condition}
//                             </Badge>
//                           )}
//                         </div>
//                       </div>
                      
//                       {/* Remove Button */}
//                       <Button 
//                         variant="ghost" 
//                         size="sm" 
//                         className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300" 
//                         onClick={() => onRemoveSelected(idx)}
//                       >
//                         <X className="h-3 w-3" />
//                       </Button>
//                     </div>
                    
//                     {/* Quantity Controls */}
//                     <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(card.id, card.quantity - 1)}
//                         disabled={card.quantity <= 1}
//                       >
//                         -
//                       </Button>
//                       <div className="flex flex-col items-center min-w-[3rem]">
//                         <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
//                           {card.quantity}
//                         </span>
//                         <span className="text-xs text-gray-500 dark:text-gray-400">
//                           of {card.maxQuantity}
//                         </span>
//                       </div>
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(card.id, card.quantity + 1)}
//                         disabled={card.quantity >= card.maxQuantity}
//                       >
//                         +
//                       </Button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
          
//           {/* Footer Actions */}
// {selectedCards.length > 0 && (
//   <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
//     {/* Summary */}
//     <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
//       <div className="flex justify-between items-center mb-1">
//         <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected:</span>
//         <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
//           {selectedCards.length} cards
//         </span>
//       </div>
//       <div className="flex justify-between items-center">
//         <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total quantity:</span>
//         <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
//           {totalCards}
//         </span>
//       </div>
//     </div>
    
//     {/* Action Buttons */}
//     <div className="flex flex-col gap-2">
//       {/* Transfer Button */}
//       {editable && onTransfer && (
//         <Button 
//           className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//           onClick={onTransfer} 
//           disabled={selectedCards.length === 0}
//         >
//           <ArrowRight className="h-4 w-4 mr-1" />
//           Transfer to Binder
//         </Button>
//       )}
      
//       {/* Delete and Clear Row */}
//       <div className="flex gap-2">
//         {editable && onDeleteSelected && (
//           <Button 
//             variant="outline"
//             className="flex-1 border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" 
//             onClick={onDeleteSelected}
//             disabled={selectedCards.length === 0}
//           >
//             <Trash2 className="h-4 w-4 mr-1" />
//             Delete
//           </Button>
//         )}
        
//         <Button 
//           variant="outline" 
//           onClick={onClearSelected} 
//           disabled={selectedCards.length === 0}
//           className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
//         >
//           Clear All
//         </Button>
//       </div>
      
//       {/* Copy Button - only show if not editable */}
//       {!editable && (
//         <Button 
//           className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//           onClick={onCopySelected} 
//           disabled={selectedCards.length === 0}
//         >
//           {copied ? (
//             <>
//               <Check className="h-4 w-4 mr-1" />
//               Copied!
//             </>
//           ) : (
//             <>
//               <Copy className="h-4 w-4 mr-1" />
//               Copy List
//             </>
//           )}
//         </Button>
//       )}
//     </div>
//   </div>
// )}
//         </div>
//       </div>
//     </>
//   )
// }


// //components/binder/SelectedCardsSidebar.tsx

// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { ShoppingCart, X, ArrowRight, Copy, Check, Package } from "lucide-react"

// // Types
// interface SelectedCardsSidebarProps {
//   selectedCards: any[]
//   sidebarOpen: boolean
//   onCloseSidebar: () => void
//   onQuantityChange: (index: number, change: number) => void
//   onRemoveSelected: (index: number) => void
//   onClearSelected: () => void
//   onTransfer?: () => void
//   onCopySelected: () => void
//   copied: boolean
//   editable: boolean
// }

// export default function SelectedCardsSidebar({
//   selectedCards,
//   sidebarOpen,
//   onCloseSidebar,
//   onQuantityChange,
//   onRemoveSelected,
//   onClearSelected,
//   onTransfer,
//   onCopySelected,
//   copied,
//   editable
// }: SelectedCardsSidebarProps) {

//   // Don't render if no cards and sidebar is closed
//   if (selectedCards.length === 0 && !sidebarOpen) {
//     return null
//   }

//   const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0);

//   return (
//     <>
//       {/* Backdrop */}
//       {sidebarOpen && (
//         <div 
//           className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
//           onClick={onCloseSidebar}
//         />
//       )}
      
//       {/* Sidebar */}
//       <div
//         className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
//           sidebarOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//         style={{ maxWidth: '100vw' }}
//       >
//         <div className="flex flex-col h-full">
          
//           {/* Header */}
//           <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
//             <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
//               <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
//               Selected Cards
//               {selectedCards.length > 0 && (
//                 <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
//                   {selectedCards.length}
//                 </Badge>
//               )}
//             </h2>
//             <Button 
//               variant="ghost" 
//               size="sm" 
//               onClick={onCloseSidebar} 
//               className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
//             >
//               <X className="h-4 w-4" />
//             </Button>
//           </div>
          
//           {/* Content */}
//           <div className="flex-1 overflow-auto">
//             {selectedCards.length === 0 ? (
//               <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
//                 <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                 <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
//                 <p className="text-sm">Click on cards to add them to your selection</p>
//               </div>
//             ) : (
//               <div className="p-4 space-y-3">
//                 {selectedCards.map((card, idx) => (
//                   <div 
//                     key={card.id + '|' + card.printingId} 
//                     className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
//                   >
//                     {/* Card Info Header */}
//                     <div className="flex justify-between items-start mb-3">
//                       <div className="flex-1 pr-2">
//                         <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
//                           {card.name || card.display_name}
//                         </p>
                        
//                         {/* Card Details Badges */}
//                         <div className="flex flex-wrap gap-1">
//                           {card.set && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.set}
//                             </Badge>
//                           )}
//                           {card.rarity && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.rarity}
//                             </Badge>
//                           )}
//                           {card.foiling && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.foiling}
//                             </Badge>
//                           )}
//                           {card.condition && card.condition !== 'NM' && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30"
//                             >
//                               {card.condition}
//                             </Badge>
//                           )}
//                         </div>
//                       </div>
                      
//                       {/* Remove Button */}
//                       <Button 
//                         variant="ghost" 
//                         size="sm" 
//                         className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300" 
//                         onClick={() => onRemoveSelected(idx)}
//                       >
//                         <X className="h-3 w-3" />
//                       </Button>
//                     </div>
                    
//                     {/* Quantity Controls */}
//                     <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(idx, -1)} 
//                         disabled={card.quantity <= 1}
//                       >
//                         -
//                       </Button>
//                       <div className="flex flex-col items-center min-w-[3rem]">
//                         <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
//                           {card.quantity}
//                         </span>
//                         <span className="text-xs text-gray-500 dark:text-gray-400">
//                           of {card.maxQuantity}
//                         </span>
//                       </div>
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(idx, 1)} 
//                         disabled={card.quantity >= card.maxQuantity}
//                       >
//                         +
//                       </Button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
          
//           {/* Footer Actions */}
//           {selectedCards.length > 0 && (
//             <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
//               {/* Summary */}
//               <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
//                 <div className="flex justify-between items-center mb-1">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected:</span>
//                   <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
//                     {selectedCards.length} cards
//                   </span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total quantity:</span>
//                   <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
//                     {totalCards}
//                   </span>
//                 </div>
//               </div>
              
//               {/* Action Buttons */}
//               <div className="flex gap-2">
//                 <Button 
//                   variant="outline" 
//                   onClick={onClearSelected} 
//                   disabled={selectedCards.length === 0}
//                   className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100"
//                 >
//                   Clear All
//                 </Button>
                
//                 {editable && onTransfer ? (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onTransfer} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     <ArrowRight className="h-4 w-4 mr-1" />
//                     Transfer
//                   </Button>
//                 ) : (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onCopySelected} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     {copied ? (
//                       <>
//                         <Check className="h-4 w-4 mr-1" />
//                         Copied!
//                       </>
//                     ) : (
//                       <>
//                         <Copy className="h-4 w-4 mr-1" />
//                         Copy List
//                       </>
//                     )}
//                   </Button>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   )
// }
// //components/binder/SelectedCardsSidebar.tsx

// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { ShoppingCart, X, ArrowRight, Copy, Check, Package } from "lucide-react"

// // Types
// interface SelectedCardsSidebarProps {
//   selectedCards: any[]
//   sidebarOpen: boolean
//   onCloseSidebar: () => void
//   onQuantityChange: (index: number, change: number) => void
//   onRemoveSelected: (index: number) => void
//   onClearSelected: () => void
//   onTransfer?: () => void
//   onCopySelected: () => void
//   copied: boolean
//   editable: boolean
// }

// export default function SelectedCardsSidebar({
//   selectedCards,
//   sidebarOpen,
//   onCloseSidebar,
//   onQuantityChange,
//   onRemoveSelected,
//   onClearSelected,
//   onTransfer,
//   onCopySelected,
//   copied,
//   editable
// }: SelectedCardsSidebarProps) {

//   // Don't render if no cards and sidebar is closed
//   if (selectedCards.length === 0 && !sidebarOpen) {
//     return null
//   }

//   const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0);

//   return (
//     <>
//       {/* Backdrop */}
//       {sidebarOpen && (
//         <div 
//           className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
//           onClick={onCloseSidebar}
//         />
//       )}
      
//       {/* Sidebar */}
//       <div
//         className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
//           sidebarOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//         style={{ maxWidth: '100vw' }}
//       >
//         <div className="flex flex-col h-full">
          
//           {/* Header */}
//           <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
//             <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
//               <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
//               Selected Cards
//               {selectedCards.length > 0 && (
//                 <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
//                   {selectedCards.length}
//                 </Badge>
//               )}
//             </h2>
//             <Button 
//               variant="ghost" 
//               size="sm" 
//               onClick={onCloseSidebar} 
//               className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
//             >
//               <X className="h-4 w-4" />
//             </Button>
//           </div>
          
//           {/* Content */}
//           <div className="flex-1 overflow-auto">
//             {selectedCards.length === 0 ? (
//               <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
//                 <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                 <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
//                 <p className="text-sm">Click on cards to add them to your selection</p>
//               </div>
//             ) : (
//               <div className="p-4 space-y-3">
//                 {selectedCards.map((card, idx) => (
//                   <div 
//                     key={card.id + '|' + card.printingId} 
//                     className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
//                   >
//                     {/* Card Info Header */}
//                     <div className="flex justify-between items-start mb-3">
//                       <div className="flex-1 pr-2">
//                         <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
//                           {card.name || card.display_name}
//                         </p>
                        
//                         {/* Card Details Badges */}
//                         <div className="flex flex-wrap gap-1">
//                           {card.set && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.set}
//                             </Badge>
//                           )}
//                           {card.rarity && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.rarity}
//                             </Badge>
//                           )}
//                           {card.foiling && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.foiling}
//                             </Badge>
//                           )}
//                           {card.condition && card.condition !== 'NM' && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30"
//                             >
//                               {card.condition}
//                             </Badge>
//                           )}
//                         </div>
//                       </div>
                      
//                       {/* Remove Button */}
//                       <Button 
//                         variant="ghost" 
//                         size="sm" 
//                         className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300" 
//                         onClick={() => onRemoveSelected(idx)}
//                       >
//                         <X className="h-3 w-3" />
//                       </Button>
//                     </div>
                    
//                     {/* Quantity Controls */}
//                     <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(idx, -1)} 
//                         disabled={card.quantity <= 1}
//                       >
//                         -
//                       </Button>
//                       <div className="flex flex-col items-center min-w-[3rem]">
//                         <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
//                           {card.quantity}
//                         </span>
//                         <span className="text-xs text-gray-500 dark:text-gray-400">
//                           of {card.maxQuantity}
//                         </span>
//                       </div>
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(idx, 1)} 
//                         disabled={card.quantity >= card.maxQuantity}
//                       >
//                         +
//                       </Button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
          
//           {/* Footer Actions */}
//           {selectedCards.length > 0 && (
//             <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
//               {/* Summary */}
//               <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
//                 <div className="flex justify-between items-center mb-1">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected:</span>
//                   <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
//                     {selectedCards.length} cards
//                   </span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total quantity:</span>
//                   <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
//                     {totalCards}
//                   </span>
//                 </div>
//               </div>
              
//               {/* Action Buttons */}
//               <div className="flex gap-2">
//                 <Button 
//                   variant="outline" 
//                   onClick={onClearSelected} 
//                   disabled={selectedCards.length === 0}
//                   className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100"
//                 >
//                   Clear All
//                 </Button>
                
//                 {editable && onTransfer ? (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onTransfer} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     <ArrowRight className="h-4 w-4 mr-1" />
//                     Transfer
//                   </Button>
//                 ) : (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onCopySelected} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     {copied ? (
//                       <>
//                         <Check className="h-4 w-4 mr-1" />
//                         Copied!
//                       </>
//                     ) : (
//                       <>
//                         <Copy className="h-4 w-4 mr-1" />
//                         Copy List
//                       </>
//                     )}
//                   </Button>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   )
// }
// //components/binder/SelectedCardsSidebar.tsx

// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { ShoppingCart, X, ArrowRight, Copy, Check } from "lucide-react"

// // Types
// interface SelectedCardsSidebarProps {
//   selectedCards: any[]
//   sidebarOpen: boolean
//   onCloseSidebar: () => void
//   onQuantityChange: (index: number, change: number) => void
//   onRemoveSelected: (index: number) => void
//   onClearSelected: () => void
//   onTransfer?: () => void
//   onCopySelected: () => void
//   copied: boolean
//   editable: boolean
// }

// export default function SelectedCardsSidebar({
//   selectedCards,
//   sidebarOpen,
//   onCloseSidebar,
//   onQuantityChange,
//   onRemoveSelected,
//   onClearSelected,
//   onTransfer,
//   onCopySelected,
//   copied,
//   editable
// }: SelectedCardsSidebarProps) {

//   // Don't render if no cards and sidebar is closed
//   if (selectedCards.length === 0 && !sidebarOpen) {
//     return null
//   }

//   return (
//     <div
//       className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-white dark:bg-gray-800 shadow-lg z-50 transition-transform duration-300 transform ${
//         sidebarOpen ? 'translate-x-0' : 'translate-x-full'
//       }`}
//       style={{ maxWidth: '100vw' }}
//     >
//       <div className="flex flex-col h-full">
        
//         {/* Header */}
//         <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
//           <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
//             <ShoppingCart className="h-5 w-5" />
//             Selected Cards
//           </h2>
//           <Button 
//             variant="ghost" 
//             size="sm" 
//             onClick={onCloseSidebar} 
//             className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
//           >
//             <X className="h-4 w-4" />
//           </Button>
//         </div>
        
//         {/* Content */}
//         <div className="flex-1 overflow-auto p-4">
//           {selectedCards.length === 0 ? (
//             <div className="text-center py-8 text-gray-500 dark:text-gray-400">
//               <ShoppingCart className="h-8 w-8 mx-auto mb-3 opacity-50" />
//               <p>No cards selected</p>
//               <p className="text-sm mt-2">Click on cards to add them to your selection</p>
//             </div>
//           ) : (
//             <div className="space-y-3">
//               {selectedCards.map((card, idx) => (
//                 <div 
//                   key={card.id + '|' + card.printingId} 
//                   className="border border-gray-200 dark:border-gray-600 rounded-md p-3 bg-gray-50 dark:bg-gray-700"
//                 >
//                   {/* Card Info Header */}
//                   <div className="flex justify-between items-start mb-2">
//                     <div className="flex-1 pr-2">
//                       <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100">
//                         {card.name || card.display_name}
//                       </p>
                      
//                       {/* Card Details Badges */}
//                       <div className="flex flex-wrap gap-1 mt-1">
//                         {card.set && (
//                           <Badge 
//                             variant="secondary" 
//                             className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
//                           >
//                             {card.set}
//                           </Badge>
//                         )}
//                         {card.rarity && (
//                           <Badge 
//                             variant="secondary" 
//                             className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
//                           >
//                             {card.rarity}
//                           </Badge>
//                         )}
//                         {card.foiling && (
//                           <Badge 
//                             variant="secondary" 
//                             className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
//                           >
//                             {card.foiling}
//                           </Badge>
//                         )}
//                         {card.condition && card.condition !== 'NM' && (
//                           <Badge 
//                             variant="secondary" 
//                             className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100"
//                           >
//                             {card.condition}
//                           </Badge>
//                         )}
//                       </div>
//                     </div>
                    
//                     {/* Remove Button */}
//                     <Button 
//                       variant="ghost" 
//                       size="sm" 
//                       className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900" 
//                       onClick={() => onRemoveSelected(idx)}
//                     >
//                       <X className="h-3 w-3" />
//                     </Button>
//                   </div>
                  
//                   {/* Quantity Controls */}
//                   <div className="flex items-center justify-center gap-2">
//                     <Button 
//                       variant="outline" 
//                       size="sm" 
//                       className="h-7 w-7 p-0 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
//                       onClick={() => onQuantityChange(idx, -1)} 
//                       disabled={card.quantity <= 1}
//                     >
//                       -
//                     </Button>
//                     <span className="font-mono text-sm min-w-[2rem] text-center text-gray-900 dark:text-gray-100">
//                       {card.quantity}
//                     </span>
//                     <Button 
//                       variant="outline" 
//                       size="sm" 
//                       className="h-7 w-7 p-0 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
//                       onClick={() => onQuantityChange(idx, 1)} 
//                       disabled={card.quantity >= card.maxQuantity}
//                     >
//                       +
//                     </Button>
//                   </div>
                  
//                   {/* Availability indicator */}
//                   <div className="text-xs text-center mt-1 text-gray-500 dark:text-gray-400">
//                     {card.quantity} of {card.maxQuantity} available
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
        
//         {/* Footer Actions */}
//         <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
//           {/* Summary */}
//           <div className="flex justify-between mb-3 font-medium text-gray-900 dark:text-gray-100">
//             <span>Total Cards:</span>
//             <span>{selectedCards.reduce((total, card) => total + card.quantity, 0)}</span>
//           </div>
          
//           {/* Action Buttons */}
//           <div className="flex gap-2">
//             <Button 
//               variant="outline" 
//               onClick={onClearSelected} 
//               disabled={selectedCards.length === 0}
//               className="flex-1 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
//             >
//               Clear All
//             </Button>
            
//             {editable && onTransfer ? (
//               <Button 
//                 className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" 
//                 onClick={onTransfer} 
//                 disabled={selectedCards.length === 0}
//               >
//                 <ArrowRight className="h-4 w-4 mr-1" />
//                 Transfer
//               </Button>
//             ) : (
//               <Button 
//                 className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" 
//                 onClick={onCopySelected} 
//                 disabled={selectedCards.length === 0}
//               >
//                 {copied ? (
//                   <>
//                     <Check className="h-4 w-4 mr-1" />
//                     Copied!
//                   </>
//                 ) : (
//                   <>
//                     <Copy className="h-4 w-4 mr-1" />
//                     Copy
//                   </>
//                 )}
//               </Button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }
// //components/binder/SelectedCardsSidebar.tsx

// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { ShoppingCart, X, ArrowRight, Copy, Check, Package, ChevronRight } from "lucide-react"

// // Types
// interface SelectedCardsSidebarProps {
//   selectedCards: any[]
//   sidebarOpen: boolean
//   onCloseSidebar: () => void
//   onQuantityChange: (cardId: string, newQuantity: number) => void
//   onRemoveSelected: (index: number) => void
//   onClearSelected: () => void
//   onTransfer?: () => void
//   onCopySelected: () => void
//   copied: boolean
//   editable: boolean
// }

// export default function SelectedCardsSidebar({
//   selectedCards,
//   sidebarOpen,
//   onCloseSidebar,
//   onQuantityChange,
//   onRemoveSelected,
//   onClearSelected,
//   onTransfer,
//   onCopySelected,
//   copied,
//   editable
// }: SelectedCardsSidebarProps) {

//   // Don't render if no cards and sidebar is closed
//   if (selectedCards.length === 0 && !sidebarOpen) {
//     return null
//   }

//   const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0);

//   return (
//     <>
//       {/* Backdrop */}
//       {sidebarOpen && (
//         <div 
//           className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
//           onClick={onCloseSidebar}
//         />
//       )}
      
//       {/* Sidebar */}
//       <div
//         className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
//           sidebarOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//         style={{ maxWidth: '100vw' }}
//       >
//         <div className="flex flex-col h-full">
          
//           {/* Header */}
//           <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
//             <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
//               <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
//               {selectedCards.length > 0 ? (
//                 <>
//                   <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
//                     {selectedCards.length}
//                   </Badge>
//                   Selected Cards
//                 </>
//               ) : (
//                 "Selected Cards"
//               )}
//             </h2>
//             <Button 
//               variant="ghost" 
//               size="sm" 
//               onClick={onCloseSidebar} 
//               className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-md border border-gray-300 dark:border-gray-500 flex items-center gap-1"
//               title="Hide sidebar"
//             >
//               <ChevronRight className="h-4 w-4" />
//               <span className="text-xs font-medium">Hide</span>
//             </Button>
//           </div>
          
//           {/* Content */}
//           <div className="flex-1 overflow-auto">
//             {selectedCards.length === 0 ? (
//               <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
//                 <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                 <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
//                 <p className="text-sm">Click on cards to add them to your selection</p>
//               </div>
//             ) : (
//               <div className="p-4 space-y-3">
//                 {selectedCards.map((card, idx) => (
//                   <div 
//                     key={card.id + '|' + card.printingId} 
//                     className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
//                   >
//                     {/* Card Info Header */}
//                     <div className="flex justify-between items-start mb-3">
//                       <div className="flex-1 pr-2">
//                         <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
//                           {card.name || card.display_name}
//                         </p>
                        
//                         {/* Card Details Badges */}
//                         <div className="flex flex-wrap gap-1">
//                           {card.set && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.set}
//                             </Badge>
//                           )}
//                           {card.rarity && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.rarity}
//                             </Badge>
//                           )}
//                           {card.foiling && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
//                             >
//                               {card.foiling}
//                             </Badge>
//                           )}
//                           {card.condition && card.condition !== 'NM' && (
//                             <Badge 
//                               variant="outline" 
//                               className="text-xs border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30"
//                             >
//                               {card.condition}
//                             </Badge>
//                           )}
//                         </div>
//                       </div>
                      
//                       {/* Remove Button */}
//                       <Button 
//                         variant="ghost" 
//                         size="sm" 
//                         className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300" 
//                         onClick={() => onRemoveSelected(idx)}
//                       >
//                         <X className="h-3 w-3" />
//                       </Button>
//                     </div>
                    
//                     {/* Quantity Controls */}
//                     <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(card.id, card.quantity - 1)}
//                         disabled={card.quantity <= 1}
//                       >
//                         -
//                       </Button>
//                       <div className="flex flex-col items-center min-w-[3rem]">
//                         <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
//                           {card.quantity}
//                         </span>
//                         <span className="text-xs text-gray-500 dark:text-gray-400">
//                           of {card.maxQuantity}
//                         </span>
//                       </div>
//                       <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
//                         onClick={() => onQuantityChange(card.id, card.quantity + 1)}
//                         disabled={card.quantity >= card.maxQuantity}
//                       >
//                         +
//                       </Button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
          
//           {/* Footer Actions */}
//           {selectedCards.length > 0 && (
//             <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-4">
//               {/* Summary */}
//               <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
//                 <div className="flex justify-between items-center mb-1">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected:</span>
//                   <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
//                     {selectedCards.length} cards
//                   </span>
//                 </div>
//                 <div className="flex justify-between items-center">
//                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total quantity:</span>
//                   <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
//                     {totalCards}
//                   </span>
//                 </div>
//               </div>
              
//               {/* Action Buttons */}
//               <div className="flex gap-2">
//                 <Button 
//                   variant="outline" 
//                   onClick={onClearSelected} 
//                   disabled={selectedCards.length === 0}
//                   className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100"
//                 >
//                   Clear All
//                 </Button>
                
//                 {editable && onTransfer ? (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onTransfer} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     <ArrowRight className="h-4 w-4 mr-1" />
//                     Transfer
//                   </Button>
//                 ) : (
//                   <Button 
//                     className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white" 
//                     onClick={onCopySelected} 
//                     disabled={selectedCards.length === 0}
//                   >
//                     {copied ? (
//                       <>
//                         <Check className="h-4 w-4 mr-1" />
//                         Copied!
//                       </>
//                     ) : (
//                       <>
//                         <Copy className="h-4 w-4 mr-1" />
//                         Copy List
//                       </>
//                     )}
//                   </Button>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   )
// }

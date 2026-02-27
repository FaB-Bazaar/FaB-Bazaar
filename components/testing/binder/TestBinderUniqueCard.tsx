"use client"

import React from "react";

interface TestBinderUniqueCardProps {
  uniqueCard: any;
  isSelected: boolean;
  onSelect: () => void;
}

export default function TestBinderUniqueCard({ uniqueCard, isSelected, onSelect }: TestBinderUniqueCardProps) {
  const totalCopies = uniqueCard.printings.reduce((sum, printing) => sum + printing.instances.length, 0);

  return (
    <div 
      className={`
        rounded-lg bg-[#2c3242] border border-gray-700 p-4 transition-all duration-300 cursor-pointer relative
        hover:border-blue-500 hover:-translate-y-1
        ${isSelected ? 'shadow-2xl shadow-blue-500/20 border-blue-500 ring-2 ring-blue-500 z-10' : 'shadow-lg'}
      `}
      onClick={onSelect}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-4">
        <img
          src={uniqueCard.image_url || "/cardback.webp"}
          alt={uniqueCard.displayName}
          className="w-20 h-28 object-contain rounded"
        />
        <div className="flex-grow">
          <h3 className="font-bold text-white text-lg">{uniqueCard.displayName}</h3>
          <p className="text-sm text-gray-400">{totalCopies} Total Cop{totalCopies > 1 ? 'ies' : 'y'}</p>
          {uniqueCard.totalValue > 0 && (
            <p className="text-sm font-semibold text-green-400">
                ~${uniqueCard.totalValue.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
// "use client"

// import React, { useState } from "react"
// import { ChevronDown } from "lucide-react"
// import TestBinderGroup from "./TestBinderGroup"

// interface TestBinderUniqueCardProps {
//   uniqueCard: any;
// }

// export default function TestBinderUniqueCard({ uniqueCard }: TestBinderUniqueCardProps) {
//   const [isExpanded, setIsExpanded] = useState(false);

//   const totalCopies = uniqueCard.printings.reduce((sum, printing) => sum + printing.instances.length, 0);
//   const totalPrintings = uniqueCard.printings.length;

//   return (
//     <div className="w-full rounded-lg bg-[#2c3242] border border-gray-700 shadow-xl p-4 transition-all duration-300">
//       <div className="flex items-center gap-6">
//         <img
//           src={uniqueCard.image_url || "/cardback.webp"}
//           alt={uniqueCard.displayName}
//           className="w-28 h-40 object-contain rounded"
//         />
//         <div className="flex-grow">
//           <h2 className="text-2xl font-bold text-white">{uniqueCard.displayName}</h2>
          
//           <div className="mt-2 text-gray-400 space-y-1">
//             <p>{totalPrintings} Unique Printing{totalPrintings > 1 ? 's' : ''}</p>
//             <p>{totalCopies} Total Cop{totalCopies > 1 ? 'ies' : 'y'}</p>
//             {uniqueCard.totalValue > 0 && (
//                 <p className="font-semibold text-green-400">
//                     ~${uniqueCard.totalValue.toFixed(2)} Total Value
//                 </p>
//             )}
//           </div>
//         </div>
//         <button
//           onClick={() => setIsExpanded(!isExpanded)}
//           className="flex items-center justify-center gap-2 text-lg text-blue-400 hover:bg-gray-700 p-3 rounded-lg self-stretch"
//           aria-expanded={isExpanded}
//         >
//           <ChevronDown className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
//         </button>
//       </div>

//       <div className={`accordion-content ${isExpanded ? 'accordion-content-expanded' : ''}`}>
//         <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
//           {uniqueCard.printings.map((printing: any) => (
//             <TestBinderGroup key={printing.printingId} group={printing} />
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }
// "use client"

// import React, { useState } from "react"
// import { ChevronDown, ChevronUp } from "lucide-react"
// import TestBinderGroup from "./TestBinderGroup" // We will render this when expanded

// interface TestBinderUniqueCardProps {
//   uniqueCard: any; // e.g., { displayName, image_url, printings: [...] }
// }

// export default function TestBinderUniqueCard({ uniqueCard }: TestBinderUniqueCardProps) {
//   const [isExpanded, setIsExpanded] = useState(false);

//   const totalCopies = uniqueCard.printings.reduce((sum, printing) => sum + printing.instances.length, 0);
//   const totalPrintings = uniqueCard.printings.length;

//   return (
//     <div className="w-full rounded-lg bg-[#2c3242] border border-gray-700 shadow-xl p-4 transition-all duration-300">
//       {/* --- TIER 1: UNIQUE CARD SUMMARY --- */}
//       <div className="flex items-center gap-6">
//         <img
//           src={uniqueCard.image_url || "/cardback.webp"}
//           alt={uniqueCard.displayName}
//           className="w-28 h-40 object-contain rounded"
//         />
//         <div className="flex-grow">
//           <h2 className="text-2xl font-bold text-white">{uniqueCard.displayName}</h2>
//           <div className="mt-2 text-gray-400">
//             <p>{totalPrintings} Unique Printing{totalPrintings > 1 ? 's' : ''}</p>
//             <p>{totalCopies} Total Cop{totalCopies > 1 ? 'ies' : 'y'}</p>
//           </div>
//         </div>
//         <button
//           onClick={() => setIsExpanded(!isExpanded)}
//           className="flex items-center justify-center gap-2 text-lg text-blue-400 hover:bg-gray-700 p-3 rounded-lg"
//         >
//           {isExpanded ? <ChevronUp /> : <ChevronDown />}
//         </button>
//       </div>

//       {/* --- TIER 2: RENDER PRINTING GROUPS WHEN EXPANDED --- */}
//       {isExpanded && (
//         <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
//           {uniqueCard.printings.map((printing: any) => (
//             // Here we reuse the TestBinderGroup component for each printing
//             <TestBinderGroup key={printing.printingId} group={printing} />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }
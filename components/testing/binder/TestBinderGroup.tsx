"use client"

import React from "react"
import { ChevronDown } from "lucide-react"
import { RarityIcon } from '@/components/shared/RarityIcon'

// NEW PROP SIGNATURE
interface TestBinderGroupProps {
  group: any;
  isSelected: boolean;
  onSelect: () => void;
}

export default function TestBinderGroup({ group, isSelected, onSelect }: TestBinderGroupProps) {
  // REMOVED: useState for isExpanded
  
  const getFoilingInfo = (foiling?: string | null) => {
    const code = (foiling || '').toUpperCase();
    const foilingMap = { /* ... */ };
    return foilingMap[code] || { name: 'Foil', className: 'bg-gray-700 text-white' };
  };

  const foilingInfo = getFoilingInfo(group.foiling);
  const totalCopies = group.instances.length;

  return (
    // NEW: Applying z-index and styles when selected
    <div className={`
      w-full rounded-lg bg-[#212734] border border-gray-700 shadow-lg p-4 transition-all duration-300 cursor-pointer
      hover:border-amber-400/50 hover:-translate-y-1
      ${isSelected ? 'shadow-2xl shadow-amber-500/20 border-amber-400 ring-2 ring-amber-400 z-10' : ''}
    `}>
      <div className="flex items-center gap-4">
        <img
          src={group.image_url || "/cardback.webp"}
          alt={group.displayName}
          className="w-24 h-32 object-contain rounded"
        />
        <div className="flex-grow space-y-2">
          <div>
            <h3 className="font-bold text-lg text-white">{group.displayName}</h3>
            <p className="text-sm text-gray-400">{group.setName?.toUpperCase()}</p>
            {group.tcg_market && (
                <p className="text-sm text-gray-300 font-semibold">
                    Market: ${group.tcg_market.toFixed(2)}
                </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {group.rarity && <RarityIcon rarityCode={group.rarity} size="sm" />}
            <div className={`text-sm rounded-full px-3 py-1 w-full text-center ${foilingInfo.className}`}>
              {foilingInfo.name}
            </div>
          </div>
        </div>
        <button
           // NEW: The whole card is clickable, but this button provides a clear target
           onClick={onSelect}
           className="flex flex-col items-center justify-center space-y-2 self-stretch p-2 hover:bg-gray-700 rounded-lg"
           aria-expanded={isSelected}
        >
           <div className="text-center">
             <div className="text-2xl font-bold text-white">{totalCopies}</div>
             <div className="text-xs text-gray-400">Cop{totalCopies > 1 ? 'ies' : 'y'}</div>
             <div className="text-xs text-green-400">({group.forTradeCount} For Trade)</div>
           </div>
           <div className="flex items-center gap-2 text-sm text-blue-400">
             <ChevronDown className={`transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`} />
             {isSelected ? 'Hide' : 'View'}
           </div>
        </button>
      </div>

      {/* REMOVED: The expanded content is no longer rendered here. */}
    </div>
  );
}
// "use client"

// import React, { useState } from "react"
// import { ChevronDown } from "lucide-react"
// import { RarityIcon } from '@/components/shared/RarityIcon'
// import TestBinderInstanceCard from "./TestBinderInstanceCard"

// interface TestBinderGroupProps {
//   group: any;
// }

// export default function TestBinderGroup({ group }: TestBinderGroupProps) {
//   const [isExpanded, setIsExpanded] = useState(false);
  
//   const getFoilingInfo = (foiling?: string | null) => {
//     const code = (foiling || '').toUpperCase();
//     const foilingMap = {
//       'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
//       'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
//       'S': { name: 'Non-foil', className: 'bg-gray-700 text-white' }
//     };
//     return foilingMap[code] || { name: 'Foil', className: 'bg-gray-700 text-white' };
//   };

//   const foilingInfo = getFoilingInfo(group.foiling);
//   const totalCopies = group.instances.length;

//   return (
//     <div className="w-full rounded-lg bg-[#212734] border border-gray-700 shadow-lg p-4 transition-all duration-300">
//       <div className="flex items-center gap-4">
//         <img
//           src={group.image_url || "/cardback.webp"}
//           alt={group.displayName}
//           className="w-24 h-32 object-contain rounded"
//           loading="lazy"
//         />
//         <div className="flex-grow space-y-2">
//           <div>
//             <h3 className="font-bold text-lg text-white">{group.displayName}</h3>
//             <p className="text-sm text-gray-400">{group.setName?.toUpperCase()}</p>
//             {group.tcg_market && (
//                 <p className="text-sm text-gray-300 font-semibold">
//                     Market: ${group.tcg_market.toFixed(2)}
//                 </p>
//             )}
//           </div>
//           <div className="flex items-center gap-2">
//             {group.rarity && <RarityIcon rarityCode={group.rarity} size="sm" />}
//             <div className={`text-sm rounded-full px-3 py-1 w-full text-center ${foilingInfo.className}`}>
//               {foilingInfo.name}
//             </div>
//           </div>
//         </div>
//         <div className="flex flex-col items-center justify-center space-y-2">
//            <div className="text-center">
//              <div className="text-2xl font-bold text-white">{totalCopies}</div>
//              <div className="text-xs text-gray-400">Cop{totalCopies > 1 ? 'ies' : 'y'}</div>
//              <div className="text-xs text-green-400">({group.forTradeCount} For Trade)</div>
//            </div>
//            <button
//              onClick={() => setIsExpanded(!isExpanded)}
//              className="w-full flex items-center justify-center gap-2 text-sm text-blue-400 hover:bg-gray-700 p-2 rounded-lg"
//              aria-expanded={isExpanded}
//            >
//              <ChevronDown className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
//              {isExpanded ? 'Hide' : 'View All'}
//            </button>
//         </div>
//       </div>

//       <div className={`accordion-content ${isExpanded ? 'accordion-content-expanded' : ''}`}>
//         <div className="mt-4 pt-4 border-t border-gray-700">
//           <div className="flex flex-wrap gap-4 justify-start">
//             {group.instances.map((instance: any) => (
//               <TestBinderInstanceCard key={instance._id} instance={instance} />
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
// "use client"

// import React, { useState } from "react"
// import { ChevronDown, ChevronUp } from "lucide-react"
// import { RarityIcon } from '@/components/shared/RarityIcon'
// import TestBinderInstanceCard from "./TestBinderInstanceCard"

// interface TestBinderGroupProps {
//   group: any; // An enriched cardGroup with its instances array
// }

// export default function TestBinderGroup({ group }: TestBinderGroupProps) {
//   const [isExpanded, setIsExpanded] = useState(false);

//   const getFoilingInfo = (foiling?: string | null) => {
//     const code = (foiling || '').toUpperCase();
//     const foilingMap = {
//       'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
//       'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
//       'S': { name: 'Non-foil', className: 'bg-gray-700 text-white' }
//     };
//     return foilingMap[code] || { name: 'Foil', className: 'bg-gray-700 text-white' };
//   };

//   const foilingInfo = getFoilingInfo(group.foiling);
//   const totalCopies = group.instances.length;

//   return (
//     <div className="w-full rounded-lg bg-[#212734] border border-gray-700 shadow-lg p-4 transition-all duration-300">
//       {/* --- COLLAPSED SUMMARY VIEW --- */}
//       <div className="flex items-center gap-4">
//         <img
//           src={group.image_url || "/cardback.webp"}
//           alt={group.displayName}
//           className="w-24 h-32 object-contain rounded"
//           loading="lazy"
//         />
//         <div className="flex-grow space-y-2">
//           <div>
//             <h3 className="font-bold text-lg text-white">{group.displayName}</h3>
//             <p className="text-sm text-gray-400">{group.setName?.toUpperCase()}</p>
//           </div>
//           <div className="flex items-center gap-2">
//             {group.rarity && <RarityIcon rarityCode={group.rarity} size="sm" />}
//             <div className={`text-sm rounded-full px-3 py-1 w-full text-center ${foilingInfo.className}`}>
//               {foilingInfo.name}
//             </div>
//           </div>
//         </div>
//         <div className="flex flex-col items-center justify-center space-y-2">
//            <div className="text-center">
//              <div className="text-2xl font-bold text-white">{totalCopies}</div>
//              <div className="text-xs text-gray-400">Cop{totalCopies > 1 ? 'ies' : 'y'}</div>
//            </div>
//            <button
//              onClick={() => setIsExpanded(!isExpanded)}
//              className="w-full flex items-center justify-center gap-2 text-sm text-blue-400 hover:bg-gray-700 p-2 rounded-lg"
//            >
//              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
//              {isExpanded ? 'Hide' : 'View'}
//            </button>
//         </div>
//       </div>

//       {/* --- EXPANDED VIEW --- */}
//       {isExpanded && (
//         <div className="mt-4 pt-4 border-t border-gray-700">
//           <div className="flex flex-wrap gap-4 justify-start">
//             {group.instances.map((instance: any) => (
//               <TestBinderInstanceCard key={instance._id} instance={instance} />
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
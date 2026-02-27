"use client"

import React, { useState, useMemo } from "react";
import TestBinderUniqueCard from "./TestBinderUniqueCard";
import TestBinderGroup from "./TestBinderGroup";
import TestBinderInstanceCard from "./TestBinderInstanceCard";

interface BinderViewClientProps {
  initialData: {
    binderInfo: any;
    uniqueCards: any[];
  };
}

export default function BinderViewClient({ initialData }: BinderViewClientProps) {
  // --- STATE MANAGEMENT FOR BOTH TIERS ---
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePrintingId, setActivePrintingId] = useState<string | null>(null);

  const handleCardSelect = (card: any) => {
    const newCardId = activeCardId === card.card_unique_id ? null : card.card_unique_id;
    setActiveCardId(newCardId);
    // IMPORTANT: When we select a new card (or deselect), we must clear the printing selection.
    setActivePrintingId(null); 
  };
  
  const handlePrintingSelect = (printing: any) => {
      const newPrintingId = activePrintingId === printing.printingId ? null : printing.printingId;
      setActivePrintingId(newPrintingId);
  }

  // --- DERIVED STATE USING useMemo FOR EFFICIENCY ---
  const activeCard = useMemo(() => {
    if (!activeCardId) return null;
    return initialData.uniqueCards.find(c => c.card_unique_id === activeCardId);
  }, [activeCardId, initialData.uniqueCards]);
  
  const activePrinting = useMemo(() => {
      if (!activeCard || !activePrintingId) return null;
      return activeCard.printings.find(p => p.printingId === activePrintingId);
  }, [activeCard, activePrintingId]);

  return (
    <div>
      <header className="mb-8"> {/* ... Header is unchanged ... */} </header>

      {/* TIER 1: The main grid of unique cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative">
        {initialData.uniqueCards.map((card) => (
          <TestBinderUniqueCard
            key={card.card_unique_id}
            uniqueCard={card}
            isSelected={activeCardId === card.card_unique_id}
            onSelect={() => handleCardSelect(card)}
          />
        ))}
      </div>
      
      {/* TIER 2: The horizontally expanding pane for PRINTINGS */}
      <div className={`accordion-content ${activeCard ? 'accordion-content-expanded' : ''}`}>
        <div className="mt-6 pt-6 border-t-2 border-blue-500/30">
          <h2 className="text-2xl font-bold mb-4">Printings for {activeCard?.displayName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
              {activeCard?.printings.map((printing: any) => (
                  <TestBinderGroup 
                    key={printing.printingId} 
                    group={printing}
                    isSelected={activePrintingId === printing.printingId}
                    onSelect={() => handlePrintingSelect(printing)}
                  />
              ))}
          </div>

          {/* TIER 3: The vertically expanding pane for INSTANCES */}
          <div className={`accordion-content ${activePrinting ? 'accordion-content-expanded' : ''}`}>
             <div className="mt-6 pt-6 border-t-2 border-amber-500/30">
                <h3 className="text-xl font-bold mb-4">Your Physical Copies</h3>
                <div className="flex flex-wrap gap-4 justify-start">
                    {activePrinting?.instances.map((instance: any) => (
                        <TestBinderInstanceCard key={instance._id} instance={instance} />
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// "use client"

// import React, { useState, useMemo } from "react";
// import TestBinderUniqueCard from "./TestBinderUniqueCard";
// import TestBinderGroup from "./TestBinderGroup";

// interface BinderViewClientProps {
//   initialData: {
//     binderInfo: any;
//     uniqueCards: any[];
//   };
// }

// export default function BinderViewClient({ initialData }: BinderViewClientProps) {
//   const [activeCardId, setActiveCardId] = useState<string | null>(null);

//   const handleCardSelect = (card: any) => {
//     if (activeCardId === card.card_unique_id) {
//       setActiveCardId(null); // Deselect if clicking the same card
//     } else {
//       setActiveCardId(card.card_unique_id);
//     }
//   };

//   // Find the full active card object based on the ID
//   const activeCard = useMemo(() => {
//     if (!activeCardId) return null;
//     return initialData.uniqueCards.find(c => c.card_unique_id === activeCardId);
//   }, [activeCardId, initialData.uniqueCards]);
  
//   const totalInstances = initialData.uniqueCards.reduce((sum, card) => 
//       sum + card.printings.reduce((pSum, p) => pSum + p.instances.length, 0), 0);

//   return (
//     <div>
//       <header className="mb-8">
//         <h1 className="text-4xl font-bold">{initialData.binderInfo.name}</h1>
//         <p className="text-lg text-gray-400 mt-2">{initialData.binderInfo.description}</p>
//         <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
//           <span><strong>Total Value:</strong> ${initialData.binderInfo.total_value?.toFixed(2)}</span>
//           <span><strong>Total Cards:</strong> {totalInstances}</span>
//           <span><strong>Unique Cards:</strong> {initialData.uniqueCards.length}</span>
//         </div>
//       </header>

//       {/* TIER 1: The main grid of unique cards */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative">
//         {initialData.uniqueCards.map((card) => (
//           <TestBinderUniqueCard
//             key={card.card_unique_id}
//             uniqueCard={card}
//             isSelected={activeCardId === card.card_unique_id}
//             onSelect={() => handleCardSelect(card)}
//           />
//         ))}
//       </div>
      
//       {/* TIER 2: The horizontally expanding pane for printings */}
//       <div className={`accordion-content ${activeCard ? 'accordion-content-expanded' : ''}`}>
//         {/* This inner div adds padding only when the content is visible */}
//         <div className="mt-6 pt-6 border-t-2 border-blue-500/30">
//           <h2 className="text-2xl font-bold mb-4">Printings for {activeCard?.displayName}</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//               {activeCard?.printings.map((printing: any) => (
//                   // TIER 3 is handled by this component's internal expansion
//                   <TestBinderGroup key={printing.printingId} group={printing} />
//               ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
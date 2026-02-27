"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, HelpCircle } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";

interface BulkImportFormProps {
  bulkInput: string;
  onInputChange: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function BulkImportForm({ bulkInput, onInputChange, onSearch, loading }: BulkImportFormProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!loading && bulkInput.trim()) {
          // Trigger form submission directly
          const form = e.currentTarget.form;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };

    return (
      <div className="mb-8">
        <div className="mb-4 p-4 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700">
          <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Bulk Import Cards</h3>
          <p className="text-sm">
            Paste your decklist or card list below to quickly find the best printings.
            <span className="block text-xs mt-1 opacity-75">
              💡 Tip: Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to submit
            </span>
          </p>
  
          <Accordion type="single" collapsible className="w-full mt-2">
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="text-xs py-1 hover:no-underline text-purple-700 dark:text-purple-300">
                <div className="flex items-center gap-1">
                  <HelpCircle className="h-4 w-4" />
                  Show Formatting Guide & Examples
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs pt-2 text-purple-800 dark:text-purple-200">
                <p className="mb-2">Enter one card per line. The following formats are supported:</p>
                <ul className="list-disc pl-5 space-y-2 font-mono">
                  <li>
                    <strong>Quantity:</strong> Start with a number (e.g., `3` or `3x`).
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x Command and Conquer</code>
                  </li>
                  <li>
                    <strong>Color:</strong> Add before the name, after the name, or in parentheses.
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">red Sink Below</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Channel Mount Heroic</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Zipper Hit (blu)</code>
                  </li>
                  <li>
                    <strong>Foiling:</strong> Specify foiling in parentheses (CF, RF, Cold Foil, Rainbow Foil, etc.).
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x Clamp Press (Cold Foil)</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Command and Conquer (RF)</code>
                  </li>
                  <li>
                    <strong>Set & Edition:</strong> Add set code and edition in parentheses.
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Enlightened Strike (WTR, 1st)</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">2x Art of War (ARC, Unlimited)</code>
                  </li>
                  <li>
                    <strong>Partial Search:</strong> Start with an asterisk `*` for a "contains" search.
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">*channel</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x *channel blue</code>
                  </li>
                   <li>
                    <strong>Advanced Combinations:</strong> Mix quantity, color, foiling, set, and edition.
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x Sink Below (red, RF, WTR)</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">2x Command and Conquer (red, 1st, RF)</code>
                    <br />
                    <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">*channel (MON, Unlimited)</code>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        <form onSubmit={onSearch}>
          <textarea
            className="w-full h-64 p-3 border rounded-md font-mono text-sm bg-white text-gray-900 placeholder-gray-500 border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600"
            placeholder={`Paste your list here...\n\nExample:\n3x Command and Conquer\nred Sink Below\n2 Zipper Hit (blue)\nClamp Press (Cold Foil)\nEnlightened Strike (WTR, 1st)\n*channel red`}
            value={bulkInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !bulkInput.trim()} className="mt-2">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Searching..." : "Import Card List"}
          </Button>
        </form>
      </div>
    );
}
// "use client";

// import React from "react";
// import { Button } from "@/components/ui/button";
// import { Loader2, HelpCircle } from "lucide-react";
// import {
//     Accordion,
//     AccordionContent,
//     AccordionItem,
//     AccordionTrigger,
//   } from "@/components/ui/accordion";

// interface BulkImportFormProps {
//   bulkInput: string;
//   onInputChange: (value: string) => void;
//   onSearch: (e: React.FormEvent) => void;
//   loading: boolean;
// }

// export default function BulkImportForm({ bulkInput, onInputChange, onSearch, loading }: BulkImportFormProps) {
//     return (
//       <div className="mb-8">
//         <div className="mb-4 p-4 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700">
//           <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Bulk Import Cards</h3>
//           <p className="text-sm">
//             Paste your decklist or card list below to quickly find the best printings.
//           </p>
  
//           <Accordion type="single" collapsible className="w-full mt-2">
//             <AccordionItem value="item-1" className="border-b-0">
//               <AccordionTrigger className="text-xs py-1 hover:no-underline text-purple-700 dark:text-purple-300">
//                 <div className="flex items-center gap-1">
//                   <HelpCircle className="h-4 w-4" />
//                   Show Formatting Guide & Examples
//                 </div>
//               </AccordionTrigger>
//               {/* --- REVISED: More comprehensive examples --- */}
//               <AccordionContent className="text-xs pt-2 text-purple-800 dark:text-purple-200">
//                 <p className="mb-2">Enter one card per line. The following formats are supported:</p>
//                 <ul className="list-disc pl-5 space-y-2 font-mono">
//                   <li>
//                     <strong>Quantity:</strong> Start with a number (e.g., `3` or `3x`).
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x Command and Conquer</code>
//                   </li>
//                   <li>
//                     <strong>Color:</strong> Add before the name, after the name, or in parentheses.
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">red Sink Below</code>
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Channel Mount Heroic</code>
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">Zipper Hit (blu)</code>
//                   </li>
//                   <li>
//                     <strong>Partial Search:</strong> Start with an asterisk `*` for a "contains" search.
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">*channel</code>
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x *channel blue</code>
//                   </li>
//                    <li>
//                     <strong>Combinations:</strong> Mix and match any of the above formats.
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">2x *sink blue</code>
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">3x Zipper Hit (blue)</code>
//                     <br />
//                     <code className="bg-purple-200 dark:bg-purple-800/50 p-1 rounded text-xs">*channel red</code>
//                   </li>
//                 </ul>
//               </AccordionContent>
//             </AccordionItem>
//           </Accordion>
  
//         </div>
//         <form onSubmit={onSearch}>
//           <textarea
//             className="w-full h-64 p-3 border rounded-md font-mono text-sm bg-white text-gray-900 placeholder-gray-500 border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600"
//             placeholder={`Paste your list here...\n\nExample:\n3x Command and Conquer\nred Sink Below\n2 Zipper Hit (blue)\n*channel red`}
//             value={bulkInput}
//             onChange={(e) => onInputChange(e.target.value)}
//             disabled={loading}
//           />
//           <Button type="submit" disabled={loading || !bulkInput.trim()} className="mt-2">
//             {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
//             {loading ? "Searching..." : "Import Card List"}
//           </Button>
//         </form>
//       </div>
//     );
//   }

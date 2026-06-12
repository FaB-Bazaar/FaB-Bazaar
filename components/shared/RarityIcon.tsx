//components/RarityIcon.tsx
import React from "react"
import { cn } from "@/lib/utils"

// Visual mapping for rarity icons (UI-specific)
const RARITY_VISUAL_MAP = {
  'c': { shape: 'circle' as const, color: '#949494', letter: 'C', label: 'Common' },
  'r': { shape: 'circle' as const, color: '#1888BF', letter: 'R', label: 'Rare' },
  's': { shape: 'circle' as const, color: '#6E4D8C', letter: 'S', label: 'Super Rare' },
  'm': { shape: 'circle' as const, color: '#A6120E', letter: 'M', label: 'Majestic' },
  'l': { shape: 'circle' as const, color: '#DC9C52', letter: 'L', label: 'Legendary' },
  'p': { shape: 'circle' as const, color: '#51A345', letter: 'P', label: 'Promo' },
  'b': { shape: 'circle' as const, color: '#6b7280', letter: 'B', label: 'Basic' },
  't': { shape: 'circle' as const, color: '#78716c', letter: 'T', label: 'Token' },
  'v': { shape: 'triangle' as const, color: '#6E4D8C', letter: null, label: 'Marvel' },
  'f': { shape: 'diamond' as const, color: '#DC9C52', letter: null, label: 'Fabled' },
} as const;

interface RarityIconProps {
  rarityCode?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function RarityIcon({ rarityCode, className, size = "md" }: RarityIconProps) {
  // Early return if no rarity code
  if (!rarityCode) return null;

  // Size mapping
  const sizeClasses = {
    sm: "w-4 h-4 text-[8px]",
    md: "w-6 h-6 text-xs", 
    lg: "w-8 h-8 text-sm",
  }

  const diamondSizes = {
    sm: "w-3 h-5",
    md: "w-5 h-7",
    lg: "w-7 h-9"
  }

  // Get rarity info with safe lookup
  const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
  const rarity = RARITY_VISUAL_MAP[rarityKey];
  
  if (!rarity) {
    // Fallback for unknown rarity codes
    return (
      <div
        className={cn(
          "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full bg-gray-200 text-gray-700 border-gray-300",
          sizeClasses[size],
          className,
        )}
        title={rarityCode}
      >
        {rarityCode.charAt(0).toUpperCase()}
      </div>
    )
  }

  // Handle special shapes
  if (rarity.shape === 'triangle') {
    // Marvel triangle
    return (
      <div
        className={cn(
          sizeClasses[size],
          className,
        )}
        style={{ 
          background: rarity.color,
          clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
          aspectRatio: '1/cos(30deg)'
        }}
        title={rarity.label}
      />
    )
  }

  if (rarity.shape === 'diamond') {
    // Fabled diamond - curved diamond with subtle concave (inward curving) sides
    const diamondDimensions = {
      sm: { width: '12px', height: '12px', path: 'M 6 0 Q 8.5 3.5, 12 6 Q 8.5 8.5, 6 12 Q 3.5 8.5, 0 6 Q 3.5 3.5, 6 0 Z' },
      md: { width: '16px', height: '16px', path: 'M 8 0 Q 11 5, 16 8 Q 11 11, 8 16 Q 5 11, 0 8 Q 5 5, 8 0 Z' },
      lg: { width: '24px', height: '24px', path: 'M 12 0 Q 16.5 7.5, 24 12 Q 16.5 16.5, 12 24 Q 7.5 16.5, 0 12 Q 7.5 7.5, 12 0 Z' }
    };

    const dims = diamondDimensions[size];

    return (
      <div
        className={cn(
          "relative inline-flex items-center justify-center",
          sizeClasses[size],
          className,
        )}
      >
        <div
          style={{
            width: dims.width,
            height: dims.height,
            background: rarity.color,
            clipPath: `path("${dims.path}")`
          }}
          title={rarity.label}
        />
      </div>
    )
  }

  // Standard circular rarity
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full text-white",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: rarity.color }}
      title={rarity.label}
    >
      {rarity.letter}
    </div>
  )
}

// Badge colors for lighter background versions
const BADGE_COLOR_MAP: Record<string, string> = {
  'c': 'bg-gray-100 text-gray-700 border-gray-300',
  'r': 'bg-blue-100 text-blue-700 border-blue-300', 
  's': 'bg-purple-100 text-purple-700 border-purple-300',
  'm': 'bg-red-100 text-red-700 border-red-300',
  'l': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'f': 'bg-yellow-100 text-yellow-700 border-yellow-300 font-semibold',
  'p': 'bg-green-100 text-green-700 border-green-300',
  't': 'bg-gray-100 text-gray-700 border-gray-300',
  'v': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  'b': 'bg-gray-100 text-gray-700 border-gray-300',
}

export function RarityBadge({
  rarityCode,
  className,
  showLabel = true,
}: { rarityCode?: string; className?: string; showLabel?: boolean }) {
  if (!rarityCode) return null

  // Get rarity info for the label
  const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
  const rarity = RARITY_VISUAL_MAP[rarityKey];
  
  if (!rarity) {
    return (
      <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700", className)}>
        <span>{rarityCode}</span>
      </div>
    )
  }

  const badgeColor = BADGE_COLOR_MAP[rarityKey] || 'bg-gray-100 text-gray-700'

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeColor,
        className,
      )}
    >
      <RarityIcon rarityCode={rarityCode} size="sm" className="mr-1" />
      {showLabel && <span>{rarity.label}</span>}
    </div>
  )
}
// import { cn } from "@/lib/utils"

// // Visual mapping for rarity icons (UI-specific)
// const RARITY_VISUAL_MAP = {
//   'c': { shape: 'circle' as const, color: '#949494', letter: 'C', label: 'Common' },
//   'r': { shape: 'circle' as const, color: '#1888BF', letter: 'R', label: 'Rare' },
//   's': { shape: 'circle' as const, color: '#6E4D8C', letter: 'S', label: 'Super Rare' },
//   'm': { shape: 'circle' as const, color: '#A6120E', letter: 'M', label: 'Majestic' },
//   'l': { shape: 'circle' as const, color: '#DC9C52', letter: 'L', label: 'Legendary' },
//   'p': { shape: 'circle' as const, color: '#51A345', letter: 'P', label: 'Promo' },
//   'b': { shape: 'circle' as const, color: '#6b7280', letter: 'B', label: 'Basic' },
//   't': { shape: 'circle' as const, color: '#78716c', letter: 'T', label: 'Token' },
//   'v': { shape: 'triangle' as const, color: '#6E4D8C', letter: null, label: 'Marvel' },
//   'f': { shape: 'diamond' as const, color: '#DC9C52', letter: null, label: 'Fabled' },
// } as const;

// interface RarityIconProps {
//   rarityCode?: string
//   className?: string
//   size?: "sm" | "md" | "lg"
// }

// export function RarityIcon({ rarityCode, className, size = "md" }: RarityIconProps) {
//   // Early return if no rarity code
//   if (!rarityCode) return null;

//   // Size mapping
//   const sizeClasses = {
//     sm: "w-4 h-4 text-[8px]",
//     md: "w-6 h-6 text-xs", 
//     lg: "w-8 h-8 text-sm",
//   }

//   const diamondSizes = {
//     sm: "w-3 h-5",
//     md: "w-5 h-7",
//     lg: "w-7 h-9"
//   }

//   // Get rarity info with safe lookup
//   const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
//   const rarity = RARITY_VISUAL_MAP[rarityKey];
  
//   if (!rarity) {
//     // Fallback for unknown rarity codes
//     return (
//       <div
//         className={cn(
//           "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full bg-gray-200 text-gray-700 border-gray-300",
//           sizeClasses[size],
//           className,
//         )}
//         title={rarityCode}
//       >
//         {rarityCode.charAt(0).toUpperCase()}
//       </div>
//     )
//   }

//   // Handle special shapes
//   if (rarity.shape === 'triangle') {
//     // Marvel triangle
//     return (
//       <div
//         className={cn(
//           sizeClasses[size],
//           className,
//         )}
//         style={{ 
//           background: rarity.color,
//           clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
//           aspectRatio: '1/cos(30deg)'
//         }}
//         title={rarity.label}
//       />
//     )
//   }

//   if (rarity.shape === 'diamond') {
//     // Fabled diamond - curved diamond with concave (inward curving) sides
//     return (
//       <div
//         className={cn(
//           "w-4 h-4 flex items-center justify-center", // Square container for centering
//           className,
//         )}
//       >
//         <div
//           style={{ 
//             width: '16px',
//             height: '16px',
//             background: rarity.color,
//             clipPath: 'path("M 8 0 Q 10 6, 16 8 Q 10 10, 8 16 Q 6 10, 0 8 Q 6 6, 8 0 Z")'
//           }}
//           title={rarity.label}
//         />
//       </div>
//     )
//   }

//   // Standard circular rarity
//   return (
//     <div
//       className={cn(
//         "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full text-white",
//         sizeClasses[size],
//         className,
//       )}
//       style={{ backgroundColor: rarity.color }}
//       title={rarity.label}
//     >
//       {rarity.letter}
//     </div>
//   )
// }

// // Badge colors for lighter background versions
// const BADGE_COLOR_MAP: Record<string, string> = {
//   'c': 'bg-gray-100 text-gray-700 border-gray-300',
//   'r': 'bg-blue-100 text-blue-700 border-blue-300', 
//   's': 'bg-purple-100 text-purple-700 border-purple-300',
//   'm': 'bg-red-100 text-red-700 border-red-300',
//   'l': 'bg-yellow-100 text-yellow-700 border-yellow-300',
//   'f': 'bg-yellow-100 text-yellow-700 border-yellow-300 font-semibold',
//   'p': 'bg-green-100 text-green-700 border-green-300',
//   't': 'bg-gray-100 text-gray-700 border-gray-300',
//   'v': 'bg-indigo-100 text-indigo-700 border-indigo-300',
//   'b': 'bg-gray-100 text-gray-700 border-gray-300',
// }

// export function RarityBadge({
//   rarityCode,
//   className,
//   showLabel = true,
// }: { rarityCode?: string; className?: string; showLabel?: boolean }) {
//   if (!rarityCode) return null

//   // Get rarity info for the label
//   const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
//   const rarity = RARITY_VISUAL_MAP[rarityKey];
  
//   if (!rarity) {
//     return (
//       <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700", className)}>
//         <span>{rarityCode}</span>
//       </div>
//     )
//   }

//   const badgeColor = BADGE_COLOR_MAP[rarityKey] || 'bg-gray-100 text-gray-700'

//   return (
//     <div
//       className={cn(
//         "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
//         badgeColor,
//         className,
//       )}
//     >
//       <RarityIcon rarityCode={rarityCode} size="sm" className="mr-1" />
//       {showLabel && <span>{rarity.label}</span>}
//     </div>
//   )
// }



// import { cn } from "@/lib/utils"

// // Visual mapping for rarity icons (UI-specific)
// const RARITY_VISUAL_MAP = {
//   'c': { shape: 'circle' as const, color: '#949494', letter: 'C', label: 'Common' },
//   'r': { shape: 'circle' as const, color: '#1888BF', letter: 'R', label: 'Rare' },
//   's': { shape: 'circle' as const, color: '#6E4D8C', letter: 'S', label: 'Super Rare' },
//   'm': { shape: 'circle' as const, color: '#A6120E', letter: 'M', label: 'Majestic' },
//   'l': { shape: 'circle' as const, color: '#DC9C52', letter: 'L', label: 'Legendary' },
//   'p': { shape: 'circle' as const, color: '#51A345', letter: 'P', label: 'Promo' },
//   'b': { shape: 'circle' as const, color: '#6b7280', letter: 'B', label: 'Basic' },
//   't': { shape: 'circle' as const, color: '#78716c', letter: 'T', label: 'Token' },
//   'v': { shape: 'triangle' as const, color: '#6E4D8C', letter: null, label: 'Marvel' },
//   'f': { shape: 'diamond' as const, color: '#DC9C52', letter: null, label: 'Fabled' },
// } as const;

// interface RarityIconProps {
//   rarityCode?: string
//   className?: string
//   size?: "sm" | "md" | "lg"
// }

// export function RarityIcon({ rarityCode, className, size = "md" }: RarityIconProps) {
//   // Early return if no rarity code
//   if (!rarityCode) return null;

//   // Size mapping
//   const sizeClasses = {
//     sm: "w-4 h-4 text-[8px]",
//     md: "w-6 h-6 text-xs", 
//     lg: "w-8 h-8 text-sm",
//   }

//   const diamondSizes = {
//     sm: "w-3 h-5",
//     md: "w-5 h-7",
//     lg: "w-7 h-9"
//   }

//   // Get rarity info with safe lookup
//   const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
//   const rarity = RARITY_VISUAL_MAP[rarityKey];
  
//   if (!rarity) {
//     // Fallback for unknown rarity codes
//     return (
//       <div
//         className={cn(
//           "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full bg-gray-200 text-gray-700 border-gray-300",
//           sizeClasses[size],
//           className,
//         )}
//         title={rarityCode}
//       >
//         {rarityCode.charAt(0).toUpperCase()}
//       </div>
//     )
//   }

//   // Handle special shapes
//   if (rarity.shape === 'triangle') {
//     // Marvel triangle
//     return (
//       <div
//         className={cn(
//           sizeClasses[size],
//           className,
//         )}
//         style={{ 
//           background: rarity.color,
//           clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
//           aspectRatio: '1/cos(30deg)'
//         }}
//         title={rarity.label}
//       />
//     )
//   }

//   if (rarity.shape === 'diamond') {
//     // Fabled diamond - curved diamond rotated and centered properly
//     return (
//       <div
//         className={cn(
//           "w-4 h-4 flex items-center justify-center", // Square container for centering
//           className,
//         )}
//       >
//         <div
//           style={{ 
//             width: '16px',
//             height: '16px',
//             background: rarity.color,
//             clipPath: 'path("M 8 0 Q 12 4, 16 8 Q 12 12, 8 16 Q 4 12, 0 8 Q 4 4, 8 0 Z")'
//           }}
//           title={rarity.label}
//         />
//       </div>
//     )
//   }

//   // Standard circular rarity
//   return (
//     <div
//       className={cn(
//         "relative inline-flex items-center justify-center border shadow-sm font-bold rounded-full text-white",
//         sizeClasses[size],
//         className,
//       )}
//       style={{ backgroundColor: rarity.color }}
//       title={rarity.label}
//     >
//       {rarity.letter}
//     </div>
//   )
// }

// // Badge colors for lighter background versions
// const BADGE_COLOR_MAP: Record<string, string> = {
//   'c': 'bg-gray-100 text-gray-700 border-gray-300',
//   'r': 'bg-blue-100 text-blue-700 border-blue-300', 
//   's': 'bg-purple-100 text-purple-700 border-purple-300',
//   'm': 'bg-red-100 text-red-700 border-red-300',
//   'l': 'bg-yellow-100 text-yellow-700 border-yellow-300',
//   'f': 'bg-yellow-100 text-yellow-700 border-yellow-300 font-semibold',
//   'p': 'bg-green-100 text-green-700 border-green-300',
//   't': 'bg-gray-100 text-gray-700 border-gray-300',
//   'v': 'bg-indigo-100 text-indigo-700 border-indigo-300',
//   'b': 'bg-gray-100 text-gray-700 border-gray-300',
// }

// export function RarityBadge({
//   rarityCode,
//   className,
//   showLabel = true,
// }: { rarityCode?: string; className?: string; showLabel?: boolean }) {
//   if (!rarityCode) return null

//   // Get rarity info for the label
//   const rarityKey = rarityCode.toLowerCase() as keyof typeof RARITY_VISUAL_MAP;
//   const rarity = RARITY_VISUAL_MAP[rarityKey];
  
//   if (!rarity) {
//     return (
//       <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700", className)}>
//         <span>{rarityCode}</span>
//       </div>
//     )
//   }

//   const badgeColor = BADGE_COLOR_MAP[rarityKey] || 'bg-gray-100 text-gray-700'

//   return (
//     <div
//       className={cn(
//         "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
//         badgeColor,
//         className,
//       )}
//     >
//       <RarityIcon rarityCode={rarityCode} size="sm" className="mr-1" />
//       {showLabel && <span>{rarity.label}</span>}
//     </div>
//   )
// }

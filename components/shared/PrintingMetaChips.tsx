"use client"

import { SET_MAP } from "@/lib/fab-constants"
import { getSetImageOrFallback } from "@/lib/set-images"
import { FoilingChip } from "@/components/shared/FoilingChip"
import { RarityIcon } from "@/components/shared/RarityIcon"

interface SetLogoProps {
  /** Set code as stored on the printing ("dtd", "wtr"…), any case. */
  set?: string | null
  /** sm = inline icon in a chip row; md = readable wordmark in a list row;
   *  lg = logo filling a tile's spare column. */
  size?: "sm" | "md" | "lg"
  className?: string
}

// Logos are transparent wordmarks that sink into the tile, so give them a
// tight dark edge. No light glow — a halo reads as generated-UI styling.
const LOGO_SIZE = {
  sm: "h-5 w-5",
  md: "h-7 w-16 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
  lg: "h-14 w-28 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
} as const

/**
 * Set logo, named for the set. Sets without a logo (most promo/product sets —
 * getSetImageOrFallback returns '') show the upper-cased code as text.
 */
export function SetLogo({ set, size = "sm", className = "" }: SetLogoProps) {
  const code = set?.toLowerCase()
  if (!code) return null
  const label = code.toUpperCase()
  const name = (SET_MAP as Record<string, string>)[code] ?? label
  const image = getSetImageOrFallback(code, label)

  if (!image) {
    return (
      <span
        title={name}
        className={`font-semibold text-gray-600 dark:text-gray-300 ${size === "lg" ? "text-sm" : "text-xs"} ${className}`}
      >
        {label}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={label}
      title={name}
      className={`object-contain ${LOGO_SIZE[size]} ${className}`}
    />
  )
}

interface PrintingMetaChipsProps {
  set?: string | null
  /** Foiling code ("s", "r", "c", "g"…). */
  foiling?: string | null
  /** Rarity code ("c", "l", "f"…). */
  rarity?: string | null
  /** false when the layout shows a large <SetLogo> elsewhere. */
  showSet?: boolean
  setSize?: "sm" | "md"
  className?: string
}

/**
 * Compact set icon + foiling chip (NF/RF/CF) + rarity icon for dense rows,
 * instead of raw DB codes.
 */
export function PrintingMetaChips({ set, foiling, rarity, showSet = true, setSize = "sm", className = "" }: PrintingMetaChipsProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showSet && <SetLogo set={set} size={setSize} />}
      {foiling && <FoilingChip foiling={foiling} />}
      {rarity && <RarityIcon rarityCode={rarity} size="sm" />}
    </div>
  )
}

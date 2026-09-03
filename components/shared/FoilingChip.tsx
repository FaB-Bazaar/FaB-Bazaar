"use client"

import { FOILING_MAP, FOILING_STYLES } from "@/lib/fab-constants"

interface FoilingChipProps {
  /** Printing foiling code: s/n (non-foil), r, c, g … case-insensitive. */
  foiling?: string | null
  className?: string
}

/**
 * Compact inline foiling marker (NF / RF / CF / GF) for dense rows such as
 * printing dropdown options, where the full FoilingBadge would be too loud.
 * Non-foil renders as a quiet outlined chip so foils stand out by contrast.
 */
export function FoilingChip({ foiling, className = "" }: FoilingChipProps) {
  const key = (foiling || "s").toLowerCase()
  const style = FOILING_STYLES[key as keyof typeof FOILING_STYLES]
  const short = style?.shortName ?? key.toUpperCase()
  const name = style?.name ?? FOILING_MAP[key as keyof typeof FOILING_MAP] ?? key.toUpperCase()
  const tone =
    short === "NF"
      ? "border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
      : style?.className ?? "bg-gray-500 text-white"

  return (
    <span
      data-testid="foiling-chip"
      role="img"
      aria-label={name}
      title={name}
      className={`inline-flex items-center rounded px-1 text-[10px] font-semibold leading-4 tracking-wide ${tone} ${className}`}
    >
      {short}
    </span>
  )
}

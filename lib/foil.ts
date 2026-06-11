// lib/foil.ts — the foil rendering POLICY, shared by every foil renderer.
//
// This is the sync contract between the CSS renderer
// (components/shared/FoilCardImage + app/foil-cards.css) and the WebGL
// renderer (components/deck/HoloCard3D). Both must agree on:
//   - which foiling codes get which treatment (getFoilType)
//   - which pixels receive rainbow foil (resolveFoilInset / getInsetFromArtStyle)
//   - how art-variation codes map to art styles (artStylesFromPrinting)
// Change the policy HERE, never inline in a renderer. The visual styling
// itself (gradients vs shader math) intentionally stays per-renderer.

/** DB-stored foil clip-path inset values for a rainbow-foil printing (percentages 0-100). */
export interface FoilInset {
  top: number | null
  right: number | null
  bottom: number | null
  left: number | null
  /** CSS length for the round corner, e.g. "1.5%", "0%", "8px". Null → "1.5%" */
  round: string | null
}

export type FoilType = 'rainbow' | 'cold' | 'none'

/**
 * Foiling code → foil treatment. Only Rainbow Foil ('R') and Cold Foil ('C')
 * get shimmer; everything else (standard, gold, etc.) renders plain.
 */
export function getFoilType(foiling?: string | null): FoilType {
  const f = foiling?.toUpperCase()
  return f === 'R' ? 'rainbow' : f === 'C' ? 'cold' : 'none'
}

/**
 * Derives rainbow-foil inset values from the artStyle array.
 * This is the fallback used when no DB-stored foilInset exists.
 */
export function getInsetFromArtStyle(artStyle: string[] | undefined): Required<FoilInset> {
  const hasExtended = artStyle?.includes('extended-art') ?? false
  const hasAlternate = artStyle?.includes('alternate-art') ?? false
  const hasBorder = artStyle?.includes('alternate-border') ?? false
  const hasFull = artStyle?.includes('full-art') ?? false

  if (hasExtended && hasAlternate && hasBorder) return { top: 0, right: 0, bottom: 30, left: 0, round: '0%' }
  if (hasExtended && hasAlternate) return { top: 0, right: 0, bottom: 26, left: 0, round: '0%' }
  if (hasFull) return { top: 1, right: 2, bottom: 20, left: 2, round: '8px' }
  if (hasBorder) return { top: 1, right: 4, bottom: 20, left: 4, round: '12px' }
  if (hasAlternate) return { top: 1, right: 4, bottom: 23, left: 4, round: '10px' }
  if (hasExtended) return { top: 1, right: 0, bottom: 18, left: 0, round: '0%' }
  return { top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' }
}

/**
 * Resolve the rainbow-foil region: DB values win, artStyle defaults fill
 * any null fields.
 */
export function resolveFoilInset(
  foilInset: FoilInset | null | undefined,
  artStyle: string[] | undefined
): Required<FoilInset> {
  const fallback = getInsetFromArtStyle(artStyle)
  if (foilInset == null) return fallback
  return {
    top: foilInset.top ?? fallback.top,
    right: foilInset.right ?? fallback.right,
    bottom: foilInset.bottom ?? fallback.bottom,
    left: foilInset.left ?? fallback.left,
    round: foilInset.round ?? fallback.round,
  }
}

/**
 * Printing art-variation codes → artStyle array for foil renderers.
 * 'AB' (alternate border) implies 'alternate-art' as well.
 */
export function artStylesFromPrinting(
  artVariations: string[] | null | undefined,
  isExtendedArt: boolean | null | undefined
): string[] {
  const styles: string[] = []
  if (artVariations?.includes('FA')) styles.push('full-art')
  if (artVariations?.includes('AA') || artVariations?.includes('AB')) styles.push('alternate-art')
  if (artVariations?.includes('AB')) styles.push('alternate-border')
  if (isExtendedArt) styles.push('extended-art')
  return styles
}

/**
 * Build a FoilInset from raw printing fields. Returns null when the bottom
 * value is missing — by convention a printing either has a full mask row or
 * none, and `foil_inset_bottom` is the presence sentinel used at call sites.
 */
export function foilInsetFromValues(
  top: number | null | undefined,
  right: number | null | undefined,
  bottom: number | null | undefined,
  left: number | null | undefined,
  round: string | null | undefined
): FoilInset | null {
  if (bottom == null) return null
  return { top: top ?? null, right: right ?? null, bottom, left: left ?? null, round: round ?? null }
}

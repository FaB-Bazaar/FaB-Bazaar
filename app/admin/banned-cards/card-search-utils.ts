// Shared helpers for the banned-cards card picker. The banned registry is keyed
// by card_unique_id (a card at one pitch), so the picker groups the printing-level
// search results into one selectable option per card.

export interface RawSearchPrinting {
  card_unique_id?: string
  name?: string
  display_name?: string
  pitch?: number | null
  color?: string | null
  image_url?: string | null
}

export interface BanCardOption {
  cardUniqueId: string
  name: string
  pitch: number | null
  color: string | null
  imageUrl: string | null
}

/**
 * Collapse printing-level search results into one option per card_unique_id.
 * Picks a display name (preferring display_name) and the first available image.
 * Printings without a card_unique_id are skipped. Sorted by name, then pitch.
 */
export function groupPrintingsToCardOptions(printings: RawSearchPrinting[]): BanCardOption[] {
  const byCard = new Map<string, BanCardOption>()

  for (const p of printings) {
    const cardUniqueId = p.card_unique_id
    if (!cardUniqueId) continue

    const name = (p.display_name || p.name || '').trim()
    const image = p.image_url || null

    const existing = byCard.get(cardUniqueId)
    if (!existing) {
      byCard.set(cardUniqueId, {
        cardUniqueId,
        name,
        pitch: p.pitch ?? null,
        color: p.color ?? null,
        imageUrl: image,
      })
    } else {
      // Backfill an image if the first printing seen lacked one.
      if (!existing.imageUrl && image) existing.imageUrl = image
      if (!existing.name && name) existing.name = name
    }
  }

  return Array.from(byCard.values()).sort((a, b) => {
    const nameDiff = a.name.localeCompare(b.name)
    if (nameDiff !== 0) return nameDiff
    return (a.pitch ?? 0) - (b.pitch ?? 0)
  })
}

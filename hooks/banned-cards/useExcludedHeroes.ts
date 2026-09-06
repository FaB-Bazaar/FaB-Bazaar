'use client'

import { useEffect, useState } from 'react'
import type { RestrictionType } from '@/lib/services/contracts/IBannedCardsService'

/**
 * Maps display format names ("Classic Constructed") to registry format keys
 * ("classic_constructed"). Returns null for formats with no registry entry.
 */
function toRegistryFormat(displayFormat: string): string | null {
  switch (displayFormat) {
    case 'Classic Constructed':
    case 'cc':
    case 'Future Classic Constructed':
    case 'future_cc':
      return 'classic_constructed'
    case 'Blitz':
    case 'blitz':
      return 'blitz'
    case 'Silver Age':
    case 'silver_age':
      return 'silver_age'
    case 'Living Legend':
    case 'll':
      return 'living_legend'
    case 'Commoner':
    case 'commoner':
      return 'commoner'
    default:
      return null
  }
}

/**
 * Fetches the heroes excluded/flagged in a format and returns a
 * Map<cardUniqueId, status> so callers can label each by its actual status
 * (banned / benched / living_legend). The status-aware companion to
 * useExcludedHeroIds (which returns just the id Set for picker filtering).
 *
 * Empty map on unmappable format / fetch failure / before resolve.
 */
export function useExcludedHeroes(format: string): Map<string, RestrictionType> {
  const [map, setMap] = useState<Map<string, RestrictionType>>(new Map())

  useEffect(() => {
    const registryFormat = toRegistryFormat(format)
    if (!registryFormat) {
      setMap(new Map())
      return
    }

    let cancelled = false
    fetch(`/api/banned-cards/heroes?format=${registryFormat}`)
      .then(r => r.json())
      .then(body => {
        if (cancelled) return
        const heroes = body?.data?.excludedHeroes as Array<{ cardUniqueId: string; status: RestrictionType }> | undefined
        if (Array.isArray(heroes)) {
          setMap(new Map(heroes.map(h => [h.cardUniqueId, h.status])))
        }
      })
      .catch(() => {
        // Swallow — empty map means "no chips", a safe failure mode.
      })

    return () => {
      cancelled = true
    }
  }, [format])

  return map
}

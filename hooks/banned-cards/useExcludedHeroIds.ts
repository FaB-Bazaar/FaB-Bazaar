'use client'

import { useEffect, useState } from 'react'

/**
 * Maps display format names ("Classic Constructed") used in the UI to the
 * registry format keys ("classic_constructed") that the API expects.
 * Returns null for formats that don't have a registry entry (Limited, Casual).
 */
function toRegistryFormat(displayFormat: string): string | null {
  switch (displayFormat) {
    case 'Classic Constructed':
    case 'cc':
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
 * Fetches the active banned hero IDs for a format from /api/banned-cards/heroes
 * and returns them as a Set<string>. Used to filter hero pickers in matchup
 * dialogs and deck listing pages.
 *
 * Returns an empty Set when format is unmappable, the fetch fails, or before
 * the fetch resolves — callers can render their full hero list in those cases
 * (graceful fallback, never blocks the UI).
 */
export function useExcludedHeroIds(format: string): Set<string> {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const registryFormat = toRegistryFormat(format)
    if (!registryFormat) {
      setExcluded(new Set())
      return
    }

    let cancelled = false
    fetch(`/api/banned-cards/heroes?format=${registryFormat}`)
      .then(r => r.json())
      .then(body => {
        if (cancelled) return
        if (body?.success && Array.isArray(body.data?.excludedHeroIds)) {
          setExcluded(new Set(body.data.excludedHeroIds))
        }
      })
      .catch(() => {
        // Swallow — empty Set means "show all heroes," which is a safer
        // failure mode than blocking the dropdown.
      })

    return () => {
      cancelled = true
    }
  }, [format])

  return excluded
}

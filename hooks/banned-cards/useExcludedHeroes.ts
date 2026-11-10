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

/**
 * Every listed format's hero restrictions in ONE request, as
 * { [displayFormat]: Map<cardUniqueId, status> }. Pass a stable array (a
 * module constant). Formats without a registry entry, a failed request and
 * the time before it resolves all give empty maps — never hides a hero.
 */
export function useExcludedHeroesByFormat<F extends string>(formats: readonly F[]): Record<F, Map<string, RestrictionType>> {
  const empty = () => Object.fromEntries(formats.map(f => [f, new Map()])) as Record<F, Map<string, RestrictionType>>
  const [byFormat, setByFormat] = useState(empty)
  const key = formats.join('|')

  useEffect(() => {
    const registry = formats.map(f => [f, toRegistryFormat(f)] as const).filter((pair): pair is readonly [F, string] => !!pair[1])
    if (registry.length === 0) return

    let cancelled = false
    fetch(`/api/banned-cards/heroes?formats=${[...new Set(registry.map(([, r]) => r))].join(',')}`)
      .then(r => r.json())
      .then(body => {
        if (cancelled) return
        const data = body?.data?.byFormat as Record<string, Array<{ cardUniqueId: string; status: RestrictionType }>> | undefined
        if (!data) return
        const next = empty()
        for (const [display, reg] of registry) {
          if (Array.isArray(data[reg])) next[display] = new Map(data[reg].map(h => [h.cardUniqueId, h.status]))
        }
        setByFormat(next)
      })
      .catch(() => {
        // Swallow — empty maps mean "no chips", a safe failure mode.
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the format names
  }, [key])

  return byFormat
}

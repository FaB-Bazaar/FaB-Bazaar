"use client"

// The viewer's price source, account-wide: TCGplayer $ (default) or Cardmarket €.
// Signed in: users.cardmarket_prices is the truth (read from /api/auth/me once per
// page load, saved via POST /api/user/cardmarket-prices); the localStorage copy
// renders the right currency before that arrives. Signed out: localStorage only.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useSession } from 'next-auth/react'
import type { PriceSource } from '@/lib/pricing/price-source'
import { readPriceSource, subscribePriceSource, writePriceSource } from '@/lib/pricing/price-source-pref'

let accountSynced = false

export function usePriceSource(): [PriceSource, (source: PriceSource) => void] {
  const { status } = useSession()
  const source = useSyncExternalStore(subscribePriceSource, readPriceSource, () => 'tcgplayer' as PriceSource)
  const signedIn = status === 'authenticated'

  useEffect(() => {
    if (!signedIn || accountSynced) return
    accountSynced = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.user?.cardmarketPrices === 'boolean') {
          writePriceSource(data.user.cardmarketPrices ? 'cardmarket' : 'tcgplayer')
        }
      })
      .catch(() => {
        accountSynced = false // retry on the next mount
      })
  }, [signedIn])

  const setSource = useCallback(
    (next: PriceSource) => {
      writePriceSource(next)
      if (signedIn) {
        fetch('/api/user/cardmarket-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next === 'cardmarket' }),
        }).catch(() => {
          // offline: this device keeps the choice; the account picks it up next time it's set
        })
      }
    },
    [signedIn],
  )

  return [source, setSource]
}

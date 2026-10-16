// components/tracking/TcgAffiliateLink.test.tsx
//
// Every "Buy on TCGplayer" link in the app renders through TcgAffiliateLink, so
// a GA `affiliate_click` event fired here answers "how often do users click an
// affiliate link, and from where" for every surface at once. `page_context`
// and `feature` are the same values already sent to Impact as subId1/subId2.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  pathname: '/daily',
  consent: { necessary: true, functional: true, analytics: true, advertising: true },
}))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('@/contexts/CookieConsentContext', () => ({
  useCookieConsent: () => ({ consentOptions: mocks.consent }),
}))
// A bare context (the real module pulls in next-auth). No provider = the
// standalone renders above; the signed-in tests wrap one.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react')
  return { AuthContext: createContext(undefined) }
})

import { TcgAffiliateLink } from './TcgAffiliateLink'
import { AuthContext } from '@/contexts/AuthContext'
import { recordPageView } from '@/lib/gtag'

const PRODUCT = 'https://www.tcgplayer.com/product/198609?Language=English'

const affiliateClicks = () =>
  (window.gtag as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => c[0] === 'event' && c[1] === 'affiliate_click')
    .map((c) => c[2] as Record<string, unknown>)

beforeEach(() => {
  window.gtag = vi.fn()
  mocks.pathname = '/daily'
  mocks.consent = { necessary: true, functional: true, analytics: true, advertising: true }
})

describe('TcgAffiliateLink click tracking', () => {
  it('sends affiliate_click with the page context, feature and destination product', () => {
    render(
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="mover_spike">
        Buy
      </TcgAffiliateLink>
    )
    fireEvent.click(screen.getByText('Buy'))

    expect(affiliateClicks()).toMatchObject([
      {
        page_context: 'DailyMovers',
        feature: 'mover_spike',
        page_path: '/daily',
        destination: PRODUCT,
        affiliate: true,
      },
    ])
  })

  it('labels clicks from the market feed page', () => {
    mocks.pathname = '/feed'
    render(
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="market_feed">
        Buy
      </TcgAffiliateLink>
    )
    fireEvent.click(screen.getByText('Buy'))

    expect(affiliateClicks()).toMatchObject([{ page_context: 'MarketFeed', feature: 'market_feed' }])
  })

  it('still reports the click (affiliate=false) when advertising consent is withheld', () => {
    mocks.consent = { ...mocks.consent, advertising: false }
    render(
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="WantsPurchaseLink">
        Buy
      </TcgAffiliateLink>
    )
    fireEvent.click(screen.getByText('Buy'))

    expect(affiliateClicks()).toMatchObject([{ feature: 'WantsPurchaseLink', affiliate: false }])
  })

  it('keeps calling the caller-supplied onClick', () => {
    const onClick = vi.fn()
    render(
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} onClick={onClick}>
        Buy
      </TcgAffiliateLink>
    )
    fireEvent.click(screen.getByText('Buy'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(affiliateClicks()).toHaveLength(1)
  })

  it('reports feature as "unspecified" when the caller did not pass one', () => {
    mocks.pathname = '/binder/abc123'
    render(<TcgAffiliateLink tcgplayerUrl={PRODUCT}>Buy</TcgAffiliateLink>)
    fireEvent.click(screen.getByText('Buy'))

    expect(affiliateClicks()).toMatchObject([{ page_context: 'Binder', feature: 'unspecified', page_path: '/binder/abc123' }])
  })

  it('carries the in-app page the visitor came from (a /daily tile leads to /printing, where the buy link is)', () => {
    recordPageView('/daily')
    recordPageView('/printing/abc123')
    mocks.pathname = '/printing/abc123'
    render(
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="PrintingRailBuy">
        Buy
      </TcgAffiliateLink>
    )
    fireEvent.click(screen.getByText('Buy'))

    expect(affiliateClicks()).toMatchObject([
      { page_context: 'PrintingDetails', page_path: '/printing/abc123', previous_page_path: '/daily' },
    ])
  })
})

// The subIds Impact reports on, read back out of the partner URL's `u` param.
const subIds = () => {
  const href = screen.getByText('Buy').closest('a')!.getAttribute('href')!
  return new URL(new URL(href).searchParams.get('u')!).searchParams
}
const renderWithAuth = (auth: { user: unknown; loading: boolean }) =>
  render(
    <AuthContext.Provider value={auth as never}>
      <TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="f">Buy</TcgAffiliateLink>
    </AuthContext.Provider>
  )

describe('TcgAffiliateLink partner subIds', () => {
  it('labels deck pages "Decks" (subId1), not "Other"', () => {
    mocks.pathname = '/decks/abc123'
    render(<TcgAffiliateLink tcgplayerUrl={PRODUCT} feature="DeckPricesBuy">Buy</TcgAffiliateLink>)
    expect(subIds().get('subId1')).toBe('Decks')
    fireEvent.click(screen.getByText('Buy'))
    expect(affiliateClicks()).toMatchObject([{ page_context: 'Decks' }])
  })

  it('reports a signed-in visitor as LoggedIn (subId3) from the auth session', () => {
    renderWithAuth({ user: { id: 'u1' }, loading: false })
    expect(subIds().get('subId3')).toBe('LoggedIn')
  })

  it('reports a signed-out visitor as Guest', () => {
    renderWithAuth({ user: null, loading: false })
    expect(subIds().get('subId3')).toBe('Guest')
  })

  it('reports Unknown while the session is still loading or outside an auth provider', () => {
    renderWithAuth({ user: null, loading: true })
    expect(subIds().get('subId3')).toBe('Unknown')
  })
})

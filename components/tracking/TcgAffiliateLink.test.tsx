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

import { TcgAffiliateLink } from './TcgAffiliateLink'
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

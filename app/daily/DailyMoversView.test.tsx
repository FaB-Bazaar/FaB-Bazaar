// app/daily/DailyMoversView.test.tsx
//
// Buy links on /daily. The "Your movers" full tiles always had one; the market
// tier (all an anonymous visitor sees) and the sparse-day compact rows had
// none, so most /daily traffic landed on a page with zero affiliate links.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DailyMoverDTO, MarketMoverDTO, MarketMoversDTO, MoversInCollectionDTO } from '@/lib/services/contracts/IDailyMoversService'

vi.mock('next/navigation', () => ({ usePathname: () => '/daily' }))
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))
// Advertising consent withheld → the buy link's href is the plain product URL,
// which keeps the assertions readable.
vi.mock('@/contexts/CookieConsentContext', () => ({
  useCookieConsent: () => ({ consentOptions: { necessary: true, functional: false, analytics: true, advertising: false } }),
}))

import { DailyMoversView } from './DailyMoversView'

const PRODUCT = 'https://www.tcgplayer.com/product/198609?Language=English'

function marketMover(over: Partial<MarketMoverDTO> = {}): MarketMoverDTO {
  return {
    printingId: 'p1',
    signalType: 'top_gainer',
    rankInSignal: 1,
    displayName: 'Enlightened Strike',
    set: 'wtr',
    edition: 'A',
    foiling: 'S',
    rarity: 'M',
    imageUrl: null,
    tcgplayerUrl: PRODUCT,
    pAtSignal: 12.5,
    refPrice: 10,
    dollarChange: 2.5,
    pctChange: 25,
    ...over,
  }
}

function marketDto(gainers: MarketMoverDTO[]): MarketMoversDTO {
  return { asOfDate: '2026-09-18', totalCount: gainers.length, gainers, decliners: [], breakouts: [], steadyRisers: [] }
}

function userMover(over: Partial<DailyMoverDTO> = {}): DailyMoverDTO {
  return { ...marketMover(), quantity: 2, binderId: 'b1', binderName: 'Main', dollarImpact: 5, decks: [], ...over }
}

const buyLinks = () => screen.queryAllByRole('link', { name: /buy/i })
const affiliateFeatures = () =>
  (window.gtag as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => c[0] === 'event' && c[1] === 'affiliate_click')
    .map((c) => (c[2] as { feature: string }).feature)

beforeEach(() => {
  window.gtag = vi.fn()
})

describe('/daily market tier', () => {
  it('renders a buy link on a market tile for an anonymous visitor', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={marketDto([marketMover()])} error={null} />)
    const links = buyLinks()
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', PRODUCT)
  })

  it('reports the click as market_<signal>', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={marketDto([marketMover()])} error={null} />)
    fireEvent.click(buyLinks()[0])
    expect(affiliateFeatures()).toEqual(['market_top_gainer'])
  })

  it('renders no buy link when the printing has no TCGplayer product', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={marketDto([marketMover({ tcgplayerUrl: null })])} error={null} />)
    expect(buyLinks()).toHaveLength(0)
  })

  it('never nests the buy link inside the card link (invalid HTML)', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={marketDto([marketMover()])} error={null} />)
    const link = buyLinks()[0]
    expect(link.parentElement?.closest('a')).toBeNull()
    // the card itself is still reachable
    expect(screen.getAllByRole('link', { name: /Enlightened Strike/ }).length).toBeGreaterThan(0)
  })
})

describe('/daily sparse-day compact rows', () => {
  const sparse: MoversInCollectionDTO = {
    asOfDate: '2026-09-18',
    totalCount: 1,
    totalImpact: 5,
    gainers: [userMover()],
    decliners: [],
    breakouts: [],
    steadyRisers: [],
  }

  it('renders a buy link on the compact row and reports it as mover_compact_<signal>', () => {
    render(<DailyMoversView signedIn={true} userMovers={sparse} market={marketDto([])} error={null} />)
    const links = buyLinks()
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', PRODUCT)
    fireEvent.click(links[0])
    expect(affiliateFeatures()).toEqual(['mover_compact_top_gainer'])
  })
})

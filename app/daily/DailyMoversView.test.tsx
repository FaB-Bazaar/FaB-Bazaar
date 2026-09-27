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

describe('/daily your movers — one row per card', () => {
  // 6+ movers used to switch to per-signal sections, repeating a card under
  // every signal it hit (and once per binder that holds it).
  const busy = (over: Partial<MoversInCollectionDTO> = {}): MoversInCollectionDTO => ({
    asOfDate: '2026-09-18',
    totalCount: 7,
    totalImpact: 20,
    gainers: [
      userMover({ printingId: 'call', displayName: 'Call to the Grave', binderId: 'b1', binderName: 'Pirate' }),
      ...['a', 'b', 'c'].map((id) => userMover({ printingId: id, displayName: `Card ${id}`, binderId: 'b1' })),
    ],
    breakouts: [
      userMover({ printingId: 'call', displayName: 'Call to the Grave', signalType: 'breakout', binderId: 'b1', binderName: 'Pirate' }),
    ],
    steadyRisers: [],
    decliners: [
      userMover({ printingId: 'levia', displayName: 'Levia, Redeemed', signalType: 'top_decliner', quantity: 1, dollarImpact: -25, binderId: 'b2', binderName: 'Trade' }),
      userMover({ printingId: 'levia', displayName: 'Levia, Redeemed', signalType: 'top_decliner', quantity: 1, dollarImpact: -25, binderId: 'b3', binderName: 'Brute' }),
    ],
    ...over,
  })

  it('shows a card that hit two signals once, tagged with both', () => {
    render(<DailyMoversView signedIn={true} userMovers={busy()} market={marketDto([])} error={null} />)
    expect(screen.getAllByRole('link', { name: 'Call to the Grave' })).toHaveLength(1)
    const row = screen.getByRole('link', { name: 'Call to the Grave' }).closest('[data-testid="mover-row"]') as HTMLElement
    expect(row.textContent).toContain('Gainer')
    expect(row.textContent).toContain('Breakout')
  })

  it('shows a card held in two binders once, with the combined count and both binders', () => {
    render(<DailyMoversView signedIn={true} userMovers={busy()} market={marketDto([])} error={null} />)
    expect(screen.getAllByRole('link', { name: 'Levia, Redeemed' })).toHaveLength(1)
    const row = screen.getByRole('link', { name: 'Levia, Redeemed' }).closest('[data-testid="mover-row"]') as HTMLElement
    expect(row.textContent).toContain('2 copies')
    expect(row.querySelector('a[href="/binder/b2"]')).not.toBeNull()
    expect(row.querySelector('a[href="/binder/b3"]')).not.toBeNull()
  })

  it('has no per-signal section headings for your cards, and no heading icons anywhere', () => {
    const { container } = render(
      <DailyMoversView signedIn={true} userMovers={busy()} market={marketDto([marketMover({ printingId: 'm1' })])} error={null} />,
    )
    expect(screen.queryByRole('heading', { level: 2, name: 'Top Gainers' })).toBeNull()
    for (const h of container.querySelectorAll('h1, h2, h3')) {
      expect(h.parentElement?.querySelector(':scope > svg')).toBeNull()
    }
  })

  it('summarises in one line under the title, counting cards rather than signals', () => {
    render(<DailyMoversView signedIn={true} userMovers={busy()} market={marketDto([])} error={null} />)
    const summary = screen.getByTestId('movers-summary')
    // 7 signal rows, but only 5 distinct cards (call ×2 signals, levia ×2 binders)
    expect(summary.textContent).toMatch(/across 5 cards in your collection/)
    expect(summary.tagName).toBe('P')
  })

  it('marks set, foiling and rarity with the set logo, NF/RF/CF chip and rarity icon — not text pills', () => {
    render(<DailyMoversView signedIn={true} userMovers={busy()} market={marketDto([])} error={null} />)
    const row = screen.getByRole('link', { name: 'Card a' }).closest('[data-testid="mover-row"]') as HTMLElement
    expect(row.querySelector('img[alt="WTR"]')).not.toBeNull()
    expect(row.querySelector('[aria-label="Non-foil"]')?.textContent).toBe('NF')
    expect(row.querySelector('[title="Majestic"]')).not.toBeNull()
    expect(row.textContent).not.toContain('Welcome to Rathe')
  })
})

describe('/daily around the market — tabs over one table', () => {
  const market: MarketMoversDTO = {
    asOfDate: '2026-09-18',
    totalCount: 3,
    gainers: [marketMover({ printingId: 'g1', displayName: 'Soul Shackle' })],
    breakouts: [marketMover({ printingId: 'b1', displayName: 'Vigor', signalType: 'breakout' })],
    steadyRisers: [],
    decliners: [marketMover({ printingId: 'd1', displayName: 'Aurora', signalType: 'top_decliner', pctChange: -16, dollarChange: -20 })],
  }

  it('shows one signal at a time as table rows, with a tab per non-empty signal', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={market} error={null} />)
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Top Gainers1', 'Breakouts1', 'Top Decliners1'])
    expect(screen.getByRole('tab', { name: /Top Gainers/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /Soul Shackle/ })).toBeTruthy()
    expect(screen.queryByText('Aurora')).toBeNull()
  })

  it('switches the table when another tab is picked', () => {
    render(<DailyMoversView signedIn={false} userMovers={null} market={market} error={null} />)
    fireEvent.click(screen.getByRole('tab', { name: /Top Decliners/ }))
    expect(screen.getByRole('row', { name: /Aurora/ })).toBeTruthy()
    expect(screen.queryByText('Soul Shackle')).toBeNull()
  })

  it('shows 10 rows, then the rest behind "Show N more"', () => {
    const many = { ...market, gainers: Array.from({ length: 13 }, (_, i) => marketMover({ printingId: `g${i}`, displayName: `Gainer ${i}` })) }
    render(<DailyMoversView signedIn={false} userMovers={null} market={many} error={null} />)
    expect(screen.getAllByRole('row', { name: /Gainer \d+/ })).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more' }))
    expect(screen.getAllByRole('row', { name: /Gainer \d+/ })).toHaveLength(13)
  })
})

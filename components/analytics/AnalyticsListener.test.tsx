// components/analytics/AnalyticsListener.test.tsx
//
// Pins the GA dataLayer ordering on first render. next-auth's useSession starts
// as "loading" on every hard load; the listener must not stamp user_type until
// the session has resolved, and the first page_view must carry the resolved
// value (a signed-in visitor's entry page was arriving as user_type=anonymous).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  pathname: '/daily',
  query: '',
  session: { data: null as null | { user: { id: string } }, status: 'loading' as 'loading' | 'authenticated' | 'unauthenticated' },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.query),
}))
vi.mock('next-auth/react', () => ({
  useSession: () => mocks.session,
}))

import { AnalyticsListener } from './AnalyticsListener'
import { getPreviousPath } from '@/lib/gtag'

type Call = unknown[]
const calls = (): Call[] => (window.gtag as ReturnType<typeof vi.fn>).mock.calls
const pageViews = () => calls().filter((c) => c[0] === 'event' && c[1] === 'page_view')
const userTypeSets = () =>
  calls().filter((c) => c[0] === 'set' && c[1] === 'user_properties').map((c) => (c[2] as { user_type: string }).user_type)

beforeEach(() => {
  process.env.NEXT_PUBLIC_GA_ID = 'G-TEST'
  window.gtag = vi.fn()
  mocks.pathname = '/daily'
  mocks.query = ''
  mocks.session = { data: null, status: 'loading' }
})

describe('AnalyticsListener', () => {
  it('sends nothing while the session is still loading', () => {
    render(<AnalyticsListener />)
    expect(userTypeSets()).toEqual([])
    expect(pageViews()).toHaveLength(0)
  })

  it('first page_view of a signed-in visitor carries user_type=authenticated, never anonymous', () => {
    const { rerender } = render(<AnalyticsListener />)
    mocks.session = { data: { user: { id: 'u1' } }, status: 'authenticated' }
    rerender(<AnalyticsListener />)

    expect(userTypeSets()).toEqual(['authenticated'])
    expect(pageViews()).toHaveLength(1)
    // the property must be set before the event is pushed
    const setIdx = calls().findIndex((c) => c[0] === 'set')
    const viewIdx = calls().findIndex((c) => c[1] === 'page_view')
    expect(setIdx).toBeLessThan(viewIdx)
  })

  it('anonymous visitor gets user_type=anonymous and one page_view once the session resolves', () => {
    const { rerender } = render(<AnalyticsListener />)
    mocks.session = { data: null, status: 'unauthenticated' }
    rerender(<AnalyticsListener />)

    expect(userTypeSets()).toEqual(['anonymous'])
    expect(pageViews()).toHaveLength(1)
    expect(pageViews()[0][2]).toMatchObject({ page_path: '/daily' })
  })

  it('a re-render on the same path does not resend the page_view', () => {
    mocks.session = { data: { user: { id: 'u1' } }, status: 'authenticated' }
    const { rerender } = render(<AnalyticsListener />)
    rerender(<AnalyticsListener />)
    expect(pageViews()).toHaveLength(1)
  })

  it('a route change sends a new page_view with the query string', () => {
    mocks.session = { data: { user: { id: 'u1' } }, status: 'authenticated' }
    const { rerender } = render(<AnalyticsListener />)
    mocks.pathname = '/opt'
    mocks.query = 'sets=iar'
    rerender(<AnalyticsListener />)
    expect(pageViews().map((c) => (c[2] as { page_path: string }).page_path)).toEqual(['/daily', '/opt?sets=iar'])
  })

  it('records the route history that affiliate clicks are attributed against', () => {
    mocks.session = { data: { user: { id: 'u1' } }, status: 'authenticated' }
    const { rerender } = render(<AnalyticsListener />)
    mocks.pathname = '/printing/abc123'
    rerender(<AnalyticsListener />)
    expect(getPreviousPath()).toBe('/daily')
  })
})

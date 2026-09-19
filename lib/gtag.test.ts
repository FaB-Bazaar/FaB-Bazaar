// lib/gtag.test.ts — in-app page history used to attribute affiliate clicks to
// the page the visitor came from (the /daily market tier has no buy links; its
// tiles lead to /printing, where the click happens).

import { describe, it, expect, vi } from 'vitest'

async function fresh() {
  vi.resetModules()
  return await import('./gtag')
}

describe('page history', () => {
  it('has no previous path before any page view is recorded', async () => {
    const g = await fresh()
    expect(g.getPreviousPath()).toBeNull()
  })

  it('returns the page before the current one', async () => {
    const g = await fresh()
    g.recordPageView('/daily')
    g.recordPageView('/printing/abc')
    expect(g.getPreviousPath()).toBe('/daily')
  })

  it('ignores a repeat of the current path', async () => {
    const g = await fresh()
    g.recordPageView('/daily')
    g.recordPageView('/printing/abc')
    g.recordPageView('/printing/abc')
    expect(g.getPreviousPath()).toBe('/daily')
  })
})

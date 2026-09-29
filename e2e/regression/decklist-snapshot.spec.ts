/**
 * Article decklists: a `snapshot` (the list frozen when the article was
 * written) is what readers see first; "Current list" loads the deck as it is
 * today and "What's changed" diffs the two. Fixture: the local Midrange Maxx
 * deck; the snapshot gets one extra card the live deck doesn't have.
 */
import { test, expect } from '@playwright/test'
import { deckToSections } from '../../web-components/src/utils/deck-sections'

const DECK = 'TofxuKKxD0ESwVR93b5AC'
test.use({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 900 } })

test('snapshot first, current list on demand, and what changed between them', async ({ page }) => {
  const live = await (await page.request.get(`/api/decks/${DECK}`)).json()
  const { sections, title } = deckToSections(live.data)
  const onlyInSnapshot = { cardName: 'Snapshot Only Card', printingId: '', quantity: 2, pitch: 1, cost: 0, power: 3, defense: 3, types: ['action'], keywords: [] }
  sections.find(s => s.label === 'LIBRARY — RED')!.cards.push(onlyInSnapshot)
  const snapshot = JSON.stringify({ label: 'Week of Calling: Atlanta', takenAt: '2026-09-28', title, sections })

  const deckRequests: string[] = []
  page.on('request', r => { if (r.url().includes(`/api/decks/${DECK}`)) deckRequests.push(r.url()) })
  await page.goto('/heroes/1zKDgRhu7j') // any page: loads the component bundle
  // Insert after hydration, or React re-renders <main> and drops the block.
  await page.locator('fab-spotlight-card').first().locator('.badge').waitFor({ timeout: 60000 })
  await page.evaluate(([id, snap]) => {
    const el = document.createElement('fab-decklist-block')
    el.id = 'snap-test'
    el.setAttribute('deck-id', id)
    el.setAttribute('snapshot', snap)
    document.querySelector('main')!.prepend(el)
  }, [DECK, snapshot])
  const block = page.locator('#snap-test')

  // Snapshot tab is selected by default and shows the frozen list — no live fetch yet.
  await expect(block.getByRole('tab', { name: 'Week of Calling: Atlanta' })).toHaveAttribute('aria-selected', 'true', { timeout: 30000 })
  await expect(block.getByText('Snapshot Only Card').first()).toBeAttached()
  await expect(block.getByRole('button', { name: /^Cost/ }).first()).toBeAttached() // stat filters work on the snapshot
  expect(deckRequests).toEqual([])

  // Current list: fetched on demand, and the snapshot-only card is gone.
  await block.getByRole('tab', { name: 'Current list' }).click()
  await expect.poll(() => deckRequests.length).toBeGreaterThan(0)
  await expect(block.getByText('Heist').first()).toBeAttached({ timeout: 30000 })
  await expect(block.getByText('Snapshot Only Card')).toHaveCount(0)

  // What's changed: the snapshot-only card shows as removed since the snapshot.
  await block.getByRole('tab', { name: "What's changed" }).click()
  await expect(block.getByRole('region', { name: 'Removed since the article' })).toContainText('2× Snapshot Only Card')
})

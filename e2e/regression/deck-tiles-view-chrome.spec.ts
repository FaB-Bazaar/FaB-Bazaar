/**
 * Deck editor tiles view — page chrome must not fight the tile grid.
 *
 * Three regressions pinned from a desktop walkthrough (2026-09):
 *  1. The pinned right rail painted over the global footer at page bottom.
 *  2. The floating "Deck Tools" pill sat bottom-center, on top of the tile grid.
 *  3. Tile actions (remove / +1 / inventory / bench / swap) were hover-only
 *     20px targets: keyboard focus left them at 20% opacity, and the tile
 *     itself (click to enlarge) was not focusable at all.
 *
 * Needs `e2e/auth.json` + a local DB with card data; creates and deletes its own deck.
 */

import { test, expect, type Page } from '@playwright/test'
import { createSeededDeck, deleteDeck } from '../helpers/deck-fixtures'

test.use({ storageState: 'e2e/auth.json' })

type Box = { x: number; y: number; width: number; height: number }
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

let deckId: string

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000)
  const page = await browser.newPage({ storageState: 'e2e/auth.json', viewport: { width: 1280, height: 800 } })
  deckId = await createSeededDeck(page, {
    namePrefix: 'e2e-tiles-chrome',
    heroQuery: 'Katsu',
    heroOption: /katsu,/i,
    // 9 red + 9 blue tiles: two rows that span the viewport's horizontal center at 1280px,
    // the blue one starting below the fold so it scrolls through the bottom band.
    seedList: '3 Sink Below (red)\n3 Snatch (red)\n3 Head Jab (red)\n3 Sink Below (blue)\n3 Snatch (blue)\n3 Head Jab (blue)',
  })
  // The save button hides optimistically; make sure the seed actually landed before closing the page.
  await page.goto(`/decks/${deckId}`)
  await expect(tileImages(page)).toHaveCount(18, { timeout: 20_000 })
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: 'e2e/auth.json' })
  await deleteDeck(page, deckId)
  await page.close()
})

async function openTiles(page: Page) {
  await page.goto(`/decks/${deckId}`)
  await expect(page.locator('#deck-section-red')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /^tiles$/i }).click()
  await expect(tileImages(page).first()).toBeVisible()
}

// Card art only: the second (aria-hidden) img has alt="", and the bench action button carries its own icon img.
const TILE_IMG = '[data-focus-id] img[alt]:not([alt=""]):not(button img):visible'
const tileImages = (page: Page) => page.locator(TILE_IMG)
const rail = (page: Page) => page.getByRole('complementary', { name: 'Deck overview' })
const toolsPill = (page: Page) => page.getByRole('button', { name: /deck tools/i })

test('pinned right rail stops above the footer instead of painting over it', async ({ page }) => {
  await openTiles(page)
  // Give the rail something tall to show, then scroll to the very bottom.
  await tileImages(page).first().hover()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400) // rail repositions on a scroll rAF

  const footerBox = (await page.locator('footer').first().boundingBox())!
  const railBox = (await rail(page).boundingBox())!
  expect(railBox.y + railBox.height).toBeLessThanOrEqual(footerBox.y + 1)
})

test('Deck Tools pill does not cover tiles or the right rail at any scroll position', async ({ page }) => {
  await openTiles(page)
  await tileImages(page).first().hover() // tall rail content
  const viewport = page.viewportSize()!

  // Sweep the whole page: at every scroll offset the (fixed) pill must be inside the
  // viewport and clear of every card tile and of the pinned right rail.
  const violations = await page.evaluate(async ({ tileSel, step }) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    type B = ReturnType<typeof box>
    const hit = (a: B, b: B) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    const triggers = [...document.querySelectorAll('button')].filter((b) => /deck tools/i.test(b.textContent ?? ''))
    const rail = document.querySelector('[role="complementary"][aria-label="Deck overview"]')
    const out: string[] = []
    const max = document.documentElement.scrollHeight - window.innerHeight
    let checked = 0
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const visible = triggers.filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
      if (visible.length === 0) { out.push(`scroll ${y}: no Deck Tools trigger visible`); continue }
      checked++
      for (const el of visible) {
        const p = box(el)
        for (const t of document.querySelectorAll(tileSel)) {
          const b = box(t)
          if (b.width > 0 && hit(p, b)) { out.push(`scroll ${y}: trigger over tile "${(t as HTMLImageElement).alt}"`); break }
        }
        // A trigger that is part of the rail can't "cover" it; a floating one must not.
        if (rail && !rail.contains(el) && hit(p, box(rail))) out.push(`scroll ${y}: trigger over the right rail`)
      }
    }
    return { out, checked }
  }, { tileSel: TILE_IMG.replace(':visible', ''), step: 40 })

  expect(violations.checked).toBeGreaterThan(5)
  expect(violations.out, violations.out.join('\n')).toEqual([])
  expect(viewport.width).toBe(1280) // xl breakpoint: the rail column is what gives the pill a free band
})

test('tile actions are keyboard reachable, visible on focus, and at least 24px', async ({ page }) => {
  await openTiles(page)
  const before = await tileImages(page).count()

  const remove = page.getByRole('button', { name: 'Remove 1 copy' }).first()
  await remove.focus()
  await expect(remove).toBeFocused()
  await expect(remove).toHaveCSS('opacity', '1')
  const box = (await remove.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(24)
  expect(box.height).toBeGreaterThanOrEqual(24)

  await page.keyboard.press('Enter')
  await expect(tileImages(page)).toHaveCount(before - 1, { timeout: 10_000 })
})

test('a tile itself takes focus and Enter opens the enlarged card', async ({ page }) => {
  await openTiles(page)
  const tile = page.locator('[data-focus-id] [title*="click to enlarge"]').first()
  await expect(tile).toHaveAttribute('tabindex', '0')
  await tile.focus()
  await expect(tile).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tile-lightbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tile-lightbox')).toHaveCount(0)
})

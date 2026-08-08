import { test, expect } from '@playwright/test'

/**
 * The /opt magnifier preview must not blow a card image up past the resolution
 * that actually exists. Card art tops out at 546x762 upstream (CardVault
 * publishes 180/376/546; the fab-cube master is the same), and the Cloudflare
 * `public` variant caps delivery at 768px tall — so rendering the modal at
 * `85vh` stretched a 762px-tall image to ~1000+ CSS px on a tall window and
 * read as pixelated next to CardVault's own (near-native) viewer.
 *
 * Asserted on a deliberately TALL viewport: at 800px tall, 85vh is already
 * under the cap and the bug is invisible.
 */

const NATIVE_CARD_HEIGHT = 768 // Cloudflare `public` variant height cap

test.describe('preview modal does not upscale beyond native art', () => {
  test.use({ viewport: { width: 1400, height: 1400 } })

  test('the enlarged card is capped near its native pixel height', async ({ page }) => {
    await page.goto('/opt')

    await page.getByRole('textbox', { name: /search/i }).first().fill('warband of bellona')
    // Grid tiles render once results land.
    const firstMagnifier = page.getByRole('button', { name: /^Preview /i }).first()
    await expect(firstMagnifier).toBeVisible({ timeout: 20_000 })
    await firstMagnifier.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const img = dialog.locator('img').first()
    await expect(img).toBeVisible()
    // Wait for decode so naturalHeight is populated.
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalHeight), { timeout: 20_000 })
      .toBeGreaterThan(0)

    const { rendered, natural } = await img.evaluate((el: HTMLImageElement) => ({
      rendered: el.getBoundingClientRect().height,
      natural: el.naturalHeight,
    }))

    // The real assertion: no meaningful upscale. Allow a 1px rounding slack.
    expect(rendered).toBeLessThanOrEqual(NATIVE_CARD_HEIGHT + 1)
    expect(rendered).toBeLessThanOrEqual(natural + 1)

    // Guard the other direction — the preview must still be a LARGE view, not
    // shrunk to a thumbnail by an over-eager cap.
    expect(rendered).toBeGreaterThan(500)
  })
})

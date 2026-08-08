import { test, expect } from '@playwright/test'

/**
 * A foil card sitting untouched must render the RAW art — no shimmer, no
 * wander. The rAF loop used to idle-animate rotation and glare with
 * `--card-opacity: 0.7` forever, which washed the art in a permanent
 * iridescent haze and read as blur/pixelation on the enlarged preview.
 *
 * Same principle the WebGL renderer already follows (components/CLAUDE.md:
 * "HoloCard3D at rest must render the raw texture EXACTLY — shader strength =
 * hover only; no idle wander"). The CSS renderer now matches it.
 *
 * EVO247 Warband of Bellona is a rainbow foil, so the foil path is active.
 */

const FOIL_CARD_QUERY = 'warband of bellona'

test.describe('foil overlay is inert until the pointer engages', () => {
  test('at rest the shimmer is fully off; hovering brings it back', async ({ page }) => {
    await page.goto(`/opt?q=${encodeURIComponent(FOIL_CARD_QUERY)}`)

    const card = page.locator('.card').first()
    await expect(card).toBeVisible({ timeout: 30_000 })

    // Park the pointer far away and let the springs settle.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(2500)

    const restOpacity = await card.evaluate(
      (el) => parseFloat(getComputedStyle(el).getPropertyValue('--card-opacity') || '0'),
    )
    expect(restOpacity).toBeLessThan(0.02)

    // And the card must not be tilted while idle.
    const restRotation = await card.evaluate((el) => {
      const s = getComputedStyle(el)
      return Math.abs(parseFloat(s.getPropertyValue('--rotate-x') || '0'))
        + Math.abs(parseFloat(s.getPropertyValue('--rotate-y') || '0'))
    })
    expect(restRotation).toBeLessThan(0.5)

    // Engaging the card brings the foil to life.
    await card.hover()
    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6)
    await page.waitForTimeout(600)

    const hoverOpacity = await card.evaluate(
      (el) => parseFloat(getComputedStyle(el).getPropertyValue('--card-opacity') || '0'),
    )
    expect(hoverOpacity).toBeGreaterThan(0.1)
  })
})

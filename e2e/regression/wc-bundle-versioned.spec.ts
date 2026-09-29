/**
 * The web-component bundle is loaded with a content-hash stamp
 * (/wc/fabbazaar-ui.js?v=<hash>) so a deploy's component changes reach
 * browsers immediately instead of after the file's 4h cache. The stamp only
 * appears on this internal script URL; page URLs are unchanged.
 */
import { test, expect } from '@playwright/test'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

test('pages load the component bundle with a hash of the current file', async ({ page }) => {
  const expected = createHash('sha256')
    .update(readFileSync(join(process.cwd(), 'public/wc/fabbazaar-ui.js')))
    .digest('hex').slice(0, 12)
  const loaded = page.waitForRequest(r => r.url().includes('/wc/fabbazaar-ui.js'))
  await page.goto('/heroes/1zKDgRhu7j')
  const url = new URL((await loaded).url())
  expect(url.pathname).toBe('/wc/fabbazaar-ui.js')
  expect(url.searchParams.get('v')).toBe(expected)
  await expect(page.locator('fab-spotlight-card').first()).toBeAttached({ timeout: 60000 })
})

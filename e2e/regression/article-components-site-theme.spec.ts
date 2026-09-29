/**
 * Article web components follow the SITE theme toggle, not the OS. With the OS
 * in dark mode and the site in light mode, cards used to render dark (and the
 * reverse). Each component mirrors <html class="dark"> onto its own `dark`
 * attribute (web-components/src/utils/theme.ts); styles key on :host([dark]).
 * Fixtures: local published articles that use intro / section-header /
 * decklist-block and key-takeaways / match-report.
 */
import { test, expect, type Page } from '@playwright/test'

const PAGES = ['/articles/6NXib9aCgE', '/articles/tR8dYlcLfh']
const TAGS = ['fab-intro', 'fab-section-header', 'fab-decklist-block', 'fab-key-takeaways', 'fab-match-report']

async function openWith(page: Page, url: string, siteDark: boolean) {
  await page.emulateMedia({ colorScheme: siteDark ? 'light' : 'dark' }) // OS disagrees with the site
  await page.addInitScript((d) => {
    localStorage.setItem('cookieConsent', 'true')
    localStorage.setItem('cookieConsentOptions', JSON.stringify({ necessary: true, analytics: false }))
    localStorage.setItem('darkMode', String(d))
  }, siteDark)
  await page.goto(url)
  await expect(page.locator(TAGS.join(', ')).first()).toBeAttached({ timeout: 60000 })
  await page.waitForTimeout(500)
}

// Each component's colours, read from inside its shadow root.
const snapshot = (page: Page) => page.evaluate((tags) => {
  const out: Record<string, { dark: boolean; colors: string }> = {}
  for (const tag of tags) {
    const el = document.querySelector(tag)
    if (!el?.shadowRoot) continue
    const nodes = [...el.shadowRoot.querySelectorAll('*')].slice(0, 40)
    out[tag] = {
      dark: el.hasAttribute('dark'),
      colors: nodes.map(n => { const cs = getComputedStyle(n); return `${cs.color}/${cs.backgroundColor}` }).join(';'),
    }
  }
  return out
}, TAGS)

for (const url of PAGES) {
  test(`components on ${url} follow the site theme, not the OS`, async ({ browser }) => {
    const light = await browser.newPage(); await openWith(light, url, false)
    const dark = await browser.newPage(); await openWith(dark, url, true)
    const a = await snapshot(light), b = await snapshot(dark)
    expect(Object.keys(a).length).toBeGreaterThan(0)
    for (const tag of Object.keys(a)) {
      expect(a[tag].dark, `${tag} light page`).toBe(false)
      expect(b[tag].dark, `${tag} dark page`).toBe(true)
      expect(a[tag].colors, `${tag} colours differ between themes`).not.toBe(b[tag].colors)
    }
    await light.close(); await dark.close()
  })
}

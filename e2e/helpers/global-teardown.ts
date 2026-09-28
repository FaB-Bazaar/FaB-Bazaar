/**
 * Sweep decks the fixture helpers created but a test never deleted — a test
 * that TIMES OUT can close its page before its finally's deleteDeck runs.
 * Matches only the helpers' naming (`<namePrefix>-<Date.now()>`, prefixes all
 * start with "e2e"), so real decks are never touched. NB a concurrent second
 * Playwright run against the same account would lose its in-flight decks.
 */
import { request, type FullConfig } from '@playwright/test'
import { existsSync } from 'fs'

const FIXTURE_DECK_NAME = /^e2e[\w-]*-\d{13}$/

export default async function globalTeardown(config: FullConfig) {
  const storageState = 'e2e/auth.json'
  if (!existsSync(storageState)) return
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const ctx = await request.newContext({ baseURL, storageState })
  try {
    const res = await ctx.get('/api/decks', { timeout: 15000 })
    if (!res.ok()) return
    const decks: Array<{ publicId: string; name: string }> = (await res.json()).decks ?? []
    const leaked = decks.filter(d => FIXTURE_DECK_NAME.test(d.name))
    for (const d of leaked) await ctx.delete(`/api/decks/${d.publicId}`, { timeout: 15000 }).catch(() => {})
    if (leaked.length) console.log(`[e2e teardown] deleted ${leaked.length} leaked fixture deck(s)`)
  } catch {
    // Best effort — a sweep failure must never fail the run.
  } finally {
    await ctx.dispose()
  }
}

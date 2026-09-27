// Display names for saved matchup plans (decks.metadata.matchups[].heroId):
// the "core" plan, strategy plans, and Talishar hero ids. Shared by the classic
// matchups dialog and deck v2's hand odds.

import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants'
import { toTalisharIdentifier } from '@/lib/utils'

export const CORE_HERO_ID = 'core'

export const STRATEGY_MATCHUP_IDS: Record<string, string> = {
  aggro: 'Aggro',
  fatigue: 'Fatigue',
  combo: 'Combo',
  midrange: 'Midrange',
}

// 'bravo, showstopper' → 'Bravo, Showstopper'
const titleCase = (key: string) => key.replace(/\b\w/g, c => c.toUpperCase())

export function matchupDisplayName(heroId: string): string {
  if (heroId === CORE_HERO_ID) return 'Core'
  if (STRATEGY_MATCHUP_IDS[heroId]) return STRATEGY_MATCHUP_IDS[heroId]
  const key = [...Object.keys(HERO_INFO), ...Object.keys(YOUNG_HERO_INFO)].find(k => toTalisharIdentifier(k) === heroId)
  return key ? titleCase(key) : heroId
}

// app/api/mcp/resource/heroIds.ts

import { VALID_HERO_IDS } from '@/lib/validation/matchup-validation';

export const heroIdsResource = {
  uri: 'fab://hero-ids',
  name: 'hero_ids',
  description: 'Valid Talishar hero IDs for use with save_deck_matchup. Read this before creating matchup plans.',
  handler() {
    return {
      note: 'Use these heroId values with save_deck_matchup. Special value "core" = baseline list with no specific opponent.',
      heroIds: ['core', ...Array.from(VALID_HERO_IDS).sort()],
    };
  }
};

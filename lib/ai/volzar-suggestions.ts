// State-aware suggested prompts for the Volzar empty state. The server page
// aggregates a tiny snapshot of the user's collection/decks/results and the
// pure rule set below picks 4 launcher prompts that exercise different
// capabilities (meta analysis, collection compare, results, search/trade) —
// personalized where the data supports it, generic where it doesn't.

// Icon keys are resolved to Lucide components client-side (VolzarChat) so this
// module stays server-safe and serializable across the RSC boundary.
export type SuggestionIcon =
  | 'trending' | 'book' | 'search' | 'chart' | 'heart' | 'layers' | 'sparkles' | 'shield';

export interface SuggestedPrompt {
  icon: SuggestionIcon;
  text: string;
}

export interface VolzarUserState {
  collectionCards: number;
  deckCount: number;
  wantsCount: number;
  /** Newest first (mirrors getRecentGameResultsForUser). */
  recentGames: Array<{ hero: string | null; deckName: string; result: 'win' | 'loss' }>;
}

/** Enough cards that "build from my collection" is a sensible question. */
const COVERAGE_MIN_CARDS = 20;
const RECENT_GAMES_LOOKBACK = 20;

export const DEFAULT_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { icon: 'trending', text: 'What are the top decks in the meta right now?' },
  { icon: 'book', text: 'Which Decks to Beat could I build mostly from my collection?' },
  { icon: 'search', text: 'Find all Ninja armor that has arcane barrier' },
  { icon: 'chart', text: 'How are my decks performing in my recent games?' },
];

/**
 * Most-played hero (by name) across the recent games, ties broken toward the
 * most recent game. Games with no hero fall back to "my <deck> deck" so the
 * personalized prompt still reads naturally.
 */
function topHeroRecord(games: VolzarUserState['recentGames']) {
  const counts = new Map<string, { label: string; wins: number; losses: number; count: number; firstIdx: number }>();
  games.forEach((g, idx) => {
    const key = g.hero ?? `deck:${g.deckName}`;
    const entry = counts.get(key) ?? {
      label: g.hero ?? `my ${g.deckName} deck`,
      wins: 0, losses: 0, count: 0, firstIdx: idx,
    };
    entry.count += 1;
    if (g.result === 'win') entry.wins += 1;
    else entry.losses += 1;
    counts.set(key, entry);
  });
  let best: ReturnType<typeof counts.get> | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count || (entry.count === best.count && entry.firstIdx < best.firstIdx)) {
      best = entry;
    }
  }
  return best;
}

export function buildSuggestedPrompts(state: VolzarUserState): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = [
    { icon: 'trending', text: 'What are the top decks in the meta right now?' },
  ];

  // Collection slot: coverage question when there's a collection to cover,
  // otherwise point brand-new users somewhere actionable.
  prompts.push(
    state.collectionCards >= COVERAGE_MIN_CARDS
      ? { icon: 'book', text: 'Which Decks to Beat could I build mostly from my collection?' }
      : { icon: 'sparkles', text: "I'm new to Flesh and Blood — what's a good budget hero to start with?" },
  );

  // Results slot: real record beats generic; decks without games get a review
  // prompt; neither gets an evergreen rules question (list_card_restrictions).
  const top = topHeroRecord(state.recentGames);
  if (top) {
    prompts.push({
      icon: 'chart',
      text: `I went ${top.wins}-${top.losses} with ${top.label} in my recent games — what should I adjust?`,
    });
  } else if (state.deckCount > 0) {
    prompts.push({ icon: 'layers', text: 'Look at my decks and suggest which one to upgrade first' });
  } else {
    prompts.push({ icon: 'shield', text: 'What cards are banned or restricted in Classic Constructed?' });
  }

  // Trade/search slot: the wants list powers a who-has lookup; without one,
  // showcase structured search.
  prompts.push(
    state.wantsCount > 0
      ? { icon: 'heart', text: 'Who has cards from my wants list available for trade?' }
      : { icon: 'search', text: 'Find all Ninja armor that has arcane barrier' },
  );

  return prompts;
}

/**
 * Snapshot the user's state and build their prompts. Every lookup degrades to
 * "empty" on failure — a broken stats query must never take down the chat
 * page — and a fully-failed snapshot returns the static defaults.
 */
export async function getVolzarSuggestedPrompts(userId: string): Promise<SuggestedPrompt[]> {
  try {
    // Lazy import: this module is imported by app code; pulling the service
    // barrel at module scope risks the ServiceFactory TDZ cycle.
    const { binderService, deckService, wantsService, gameResultsService } =
      await import('@/lib/services');

    const [binders, decks, wants, recent] = await Promise.allSettled([
      binderService.getUserBindersWithStats(userId),
      deckService.listUserDecksBasic(userId),
      wantsService.getTotalWantsQuantity(userId),
      gameResultsService.getRecentGameResultsForUser(userId, RECENT_GAMES_LOOKBACK),
    ]);

    const ok = <T,>(r: PromiseSettledResult<{ success: true; data: T } | { success: false; error: string }>): T | undefined =>
      r.status === 'fulfilled' && r.value.success ? r.value.data : undefined;

    const binderData = ok(binders);
    const deckData = ok(decks);
    const wantsData = ok(wants);
    const recentData = ok(recent);

    if (!binderData && !deckData && wantsData === undefined && !recentData) {
      return DEFAULT_SUGGESTED_PROMPTS;
    }

    return buildSuggestedPrompts({
      collectionCards: (binderData ?? []).reduce((sum, b) => sum + (b.stats?.totalQuantity ?? 0), 0),
      deckCount: deckData?.length ?? 0,
      wantsCount: wantsData ?? 0,
      recentGames: (recentData ?? []).map((g) => ({
        hero: g.playerHero ?? null,
        deckName: g.deckName,
        result: g.result,
      })),
    });
  } catch (error) {
    console.error('[Volzar] suggested-prompts snapshot failed:', error);
    return DEFAULT_SUGGESTED_PROMPTS;
  }
}

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

export type SuggestionLanguage = 'en' | 'fr' | 'de' | 'it' | 'es' | 'ja';

// Card-platform languages by home country (mirrors search_printings'
// options.language support). Multilingual countries (CH, BE, CA) stay
// English — guessing wrong there is worse than defaulting.
const COUNTRY_LANGUAGE: Record<string, SuggestionLanguage> = {
  FR: 'fr',
  DE: 'de', AT: 'de',
  IT: 'it',
  ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es', UY: 'es',
  EC: 'es', VE: 'es', GT: 'es', CR: 'es', PA: 'es', DO: 'es', BO: 'es',
  PY: 'es', HN: 'es', NI: 'es', SV: 'es',
  JP: 'ja',
};

/** users.country_code → suggested-prompt language ('en' when unknown). */
export function languageForCountry(countryCode?: string | null): SuggestionLanguage {
  if (!countryCode) return 'en';
  return COUNTRY_LANGUAGE[countryCode.toUpperCase()] ?? 'en';
}

// Per-language template set. Product names (Decks to Beat, Flesh and Blood,
// Classic Constructed) and searchable mechanic keywords stay in English —
// the model maps them to tools reliably; translated card-game jargon doesn't.
type PromptTexts = {
  meta: string;
  coverage: string;
  newbie: string;
  record: (wins: number, losses: number, label: string) => string;
  upgrade: string;
  banned: string;
  whoHas: string;
  search: string;
};

const PROMPT_TEXTS: Record<SuggestionLanguage, PromptTexts> = {
  en: {
    meta: 'What are the top decks in the meta right now?',
    coverage: 'Which Decks to Beat could I build mostly from my collection?',
    newbie: "I'm new to Flesh and Blood — what's a good budget hero to start with?",
    record: (w, l, label) => `I went ${w}-${l} with ${label} in my recent games — what should I adjust?`,
    upgrade: 'Look at my decks and suggest which one to upgrade first',
    banned: 'What cards are banned or restricted in Classic Constructed?',
    whoHas: 'Who has cards from my wants list available for trade?',
    search: 'Find all Ninja armor that has arcane barrier',
  },
  fr: {
    meta: 'Quels sont les meilleurs decks du méta en ce moment ?',
    coverage: 'Quels Decks to Beat pourrais-je construire principalement avec ma collection ?',
    newbie: 'Je débute à Flesh and Blood — quel héros à petit budget me conseilles-tu pour commencer ?',
    record: (w, l, label) => `J'ai fait ${w}-${l} avec ${label} dans mes dernières parties — que devrais-je ajuster ?`,
    upgrade: 'Regarde mes decks et dis-moi lequel améliorer en premier',
    banned: 'Quelles cartes sont bannies ou restreintes en Classic Constructed ?',
    whoHas: "Qui propose à l'échange des cartes de ma liste de recherche ?",
    search: 'Trouve toutes les armures Ninja avec arcane barrier',
  },
  de: {
    meta: 'Was sind aktuell die Top-Decks im Meta?',
    coverage: 'Welche Decks to Beat könnte ich größtenteils aus meiner Sammlung bauen?',
    newbie: 'Ich bin neu bei Flesh and Blood — welcher günstige Held eignet sich für den Einstieg?',
    record: (w, l, label) => `Ich habe in meinen letzten Spielen ${w}-${l} mit ${label} gespielt — was sollte ich anpassen?`,
    upgrade: 'Sieh dir meine Decks an und schlag vor, welches ich zuerst verbessern sollte',
    banned: 'Welche Karten sind in Classic Constructed gebannt oder eingeschränkt?',
    whoHas: 'Wer bietet Karten von meiner Suchliste zum Tausch an?',
    search: 'Finde alle Ninja-Rüstungen mit arcane barrier',
  },
  it: {
    meta: 'Quali sono i migliori mazzi del meta in questo momento?',
    coverage: 'Quali Decks to Beat potrei costruire in gran parte con la mia collezione?',
    newbie: 'Sono nuovo a Flesh and Blood — quale eroe economico mi consigli per iniziare?',
    record: (w, l, label) => `Ho fatto ${w}-${l} con ${label} nelle mie ultime partite — cosa dovrei sistemare?`,
    upgrade: 'Guarda i miei mazzi e suggerisci quale potenziare per primo',
    banned: 'Quali carte sono bandite o limitate in Classic Constructed?',
    whoHas: 'Chi ha carte della mia lista dei desideri disponibili per lo scambio?',
    search: 'Trova tutte le armature Ninja con arcane barrier',
  },
  es: {
    meta: '¿Cuáles son los mejores mazos del meta ahora mismo?',
    coverage: '¿Qué Decks to Beat podría construir principalmente con mi colección?',
    newbie: 'Soy nuevo en Flesh and Blood — ¿qué héroe económico me recomiendas para empezar?',
    record: (w, l, label) => `Fui ${w}-${l} con ${label} en mis últimas partidas — ¿qué debería ajustar?`,
    upgrade: 'Mira mis mazos y sugiere cuál mejorar primero',
    banned: '¿Qué cartas están prohibidas o restringidas en Classic Constructed?',
    whoHas: '¿Quién tiene cartas de mi lista de deseos disponibles para intercambio?',
    search: 'Encuentra todas las armaduras Ninja con arcane barrier',
  },
  ja: {
    meta: '今のメタで強いデッキは？',
    coverage: '自分のコレクションでほぼ組めるDecks to Beatはどれ？',
    newbie: 'Flesh and Blood初心者です — 低予算で始めるのにおすすめのヒーローは？',
    record: (w, l, label) => `最近の対戦で${label}を使って${w}勝${l}敗でした — 何を調整すべき？`,
    upgrade: '私のデッキを見て、最初に強化すべきデッキを教えて',
    banned: 'Classic Constructedで禁止・制限されているカードは？',
    whoHas: '私のウォンツリストのカードをトレードに出している人は？',
    search: 'アーケインバリアを持つニンジャの防具を探して',
  },
};

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

export function buildSuggestedPrompts(state: VolzarUserState, language: SuggestionLanguage = 'en'): SuggestedPrompt[] {
  const t = PROMPT_TEXTS[language] ?? PROMPT_TEXTS.en;
  const prompts: SuggestedPrompt[] = [
    { icon: 'trending', text: t.meta },
  ];

  // Collection slot: coverage question when there's a collection to cover,
  // otherwise point brand-new users somewhere actionable.
  prompts.push(
    state.collectionCards >= COVERAGE_MIN_CARDS
      ? { icon: 'book', text: t.coverage }
      : { icon: 'sparkles', text: t.newbie },
  );

  // Results slot: real record beats generic; decks without games get a review
  // prompt; neither gets an evergreen rules question (list_card_restrictions).
  const top = topHeroRecord(state.recentGames);
  if (top) {
    prompts.push({ icon: 'chart', text: t.record(top.wins, top.losses, top.label) });
  } else if (state.deckCount > 0) {
    prompts.push({ icon: 'layers', text: t.upgrade });
  } else {
    prompts.push({ icon: 'shield', text: t.banned });
  }

  // Trade/search slot: the wants list powers a who-has lookup; without one,
  // showcase structured search.
  prompts.push(
    state.wantsCount > 0
      ? { icon: 'heart', text: t.whoHas }
      : { icon: 'search', text: t.search },
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
    const { binderService, deckService, wantsService, gameResultsService, userService } =
      await import('@/lib/services');

    const [binders, decks, wants, recent, userRow] = await Promise.allSettled([
      binderService.getUserBindersWithStats(userId),
      deckService.listUserDecksBasic(userId),
      wantsService.getTotalWantsQuantity(userId),
      gameResultsService.getRecentGameResultsForUser(userId, RECENT_GAMES_LOOKBACK),
      userService.getBasicInfo(userId),
    ]);

    const ok = <T,>(r: PromiseSettledResult<{ success: true; data: T } | { success: false; error: string }>): T | undefined =>
      r.status === 'fulfilled' && r.value.success ? r.value.data : undefined;

    const binderData = ok(binders);
    const deckData = ok(decks);
    const wantsData = ok(wants);
    const recentData = ok(recent);
    // Country-set users get the prompts in their language (best-effort).
    const language = languageForCountry(ok(userRow)?.countryCode);

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
    }, language);
  } catch (error) {
    console.error('[Volzar] suggested-prompts snapshot failed:', error);
    return DEFAULT_SUGGESTED_PROMPTS;
  }
}

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

export type SuggestionLanguage = 'en' | 'fr' | 'de' | 'it' | 'es' | 'ja' | 'da' | 'sv' | 'ko' | 'zh' | 'pt';

// Prompt language by home country. The fr/de/it/es/ja set mirrors
// search_printings' card languages; da/sv/ko/zh/pt are chat-only (the model
// speaks them; card searches still resolve via English names). Multilingual
// countries (CH, BE, CA) stay English — guessing wrong there is worse than
// defaulting. CN → simplified Chinese; TW/HK (traditional) and SG stay
// English — explicit product decision (2026-07), do not add them.
const COUNTRY_LANGUAGE: Record<string, SuggestionLanguage> = {
  FR: 'fr',
  DE: 'de', AT: 'de',
  IT: 'it',
  ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es', UY: 'es',
  EC: 'es', VE: 'es', GT: 'es', CR: 'es', PA: 'es', DO: 'es', BO: 'es',
  PY: 'es', HN: 'es', NI: 'es', SV: 'es',
  JP: 'ja',
  DK: 'da',
  SE: 'sv',
  KR: 'ko',
  CN: 'zh',
  BR: 'pt', PT: 'pt',
};

/** Display names for the reply-language instruction in the system prompt. */
export const SUGGESTION_LANGUAGE_NAMES: Record<SuggestionLanguage, string> = {
  en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish',
  ja: 'Japanese', da: 'Danish', sv: 'Swedish', ko: 'Korean',
  zh: 'Simplified Chinese', pt: 'Portuguese',
};

/**
 * Full language resolution: an explicit (valid) preferred_language wins;
 * otherwise the country mapping; otherwise English. 'en' as an explicit
 * preference is final — a French resident who wants English gets English.
 */
export function resolveUserLanguage(user: {
  preferredLanguage?: string | null;
  countryCode?: string | null;
}): SuggestionLanguage {
  const pref = user.preferredLanguage?.toLowerCase();
  if (pref && pref in PROMPT_TEXTS) return pref as SuggestionLanguage;
  return languageForCountry(user.countryCode);
}

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
  da: {
    meta: 'Hvad er de bedste decks i metaen lige nu?',
    coverage: 'Hvilke Decks to Beat kunne jeg bygge mest ud fra min samling?',
    newbie: 'Jeg er ny til Flesh and Blood — hvilken billig helt er god at starte med?',
    record: (w, l, label) => `Jeg gik ${w}-${l} med ${label} i mine seneste kampe — hvad bør jeg justere?`,
    upgrade: 'Kig på mine decks og foreslå, hvilket jeg skal opgradere først',
    banned: 'Hvilke kort er bannede eller begrænsede i Classic Constructed?',
    whoHas: 'Hvem har kort fra min ønskeliste til bytte?',
    search: 'Find alle Ninja-rustninger med arcane barrier',
  },
  sv: {
    meta: 'Vilka är de bästa deckarna i metan just nu?',
    coverage: 'Vilka Decks to Beat skulle jag kunna bygga mestadels från min samling?',
    newbie: 'Jag är ny på Flesh and Blood — vilken budgethjälte är bra att börja med?',
    record: (w, l, label) => `Jag gick ${w}-${l} med ${label} i mina senaste matcher — vad borde jag justera?`,
    upgrade: 'Titta på mina decks och föreslå vilket jag ska uppgradera först',
    banned: 'Vilka kort är bannade eller begränsade i Classic Constructed?',
    whoHas: 'Vem har kort från min önskelista tillgängliga för byte?',
    search: 'Hitta alla Ninja-rustningar med arcane barrier',
  },
  ko: {
    meta: '지금 메타에서 가장 강한 덱은 뭐야?',
    coverage: '내 컬렉션으로 거의 만들 수 있는 Decks to Beat은 어떤 거야?',
    newbie: 'Flesh and Blood 입문자인데 — 저예산으로 시작하기 좋은 영웅은?',
    record: (w, l, label) => `최근 경기에서 ${label} 사용, ${w}승 ${l}패였어 — 뭘 조정해야 할까?`,
    upgrade: '내 덱들을 보고 어떤 덱부터 업그레이드할지 추천해 줘',
    banned: 'Classic Constructed에서 금지되거나 제한된 카드는?',
    whoHas: '내 원츠 리스트 카드를 트레이드로 내놓은 사람 있어?',
    search: 'arcane barrier가 있는 Ninja 방어구를 모두 찾아 줘',
  },
  zh: {
    meta: '现在环境里最强的牌组有哪些？',
    coverage: '哪些 Decks to Beat 我可以主要用自己的收藏组出来？',
    newbie: '我是 Flesh and Blood 新手 — 有什么适合入门的平价英雄？',
    record: (w, l, label) => `最近的对局里我用 ${label} 打出了 ${w} 胜 ${l} 负 — 我该调整什么？`,
    upgrade: '看看我的牌组，建议先升级哪一副',
    banned: 'Classic Constructed 里有哪些牌被禁用或限制？',
    whoHas: '谁有我愿望清单里的牌可以交换？',
    search: '找出所有带 arcane barrier 的 Ninja 护甲',
  },
  pt: {
    meta: 'Quais são os melhores decks do meta agora?',
    coverage: 'Quais Decks to Beat eu poderia montar principalmente com a minha coleção?',
    newbie: 'Sou novo em Flesh and Blood — qual herói barato é bom para começar?',
    record: (w, l, label) => `Fiz ${w}-${l} com ${label} nas minhas últimas partidas — o que devo ajustar?`,
    upgrade: 'Olhe meus decks e sugira qual melhorar primeiro',
    banned: 'Quais cartas estão banidas ou restritas no Classic Constructed?',
    whoHas: 'Quem tem cartas da minha lista de desejos disponíveis para troca?',
    search: 'Encontre todas as armaduras Ninja com arcane barrier',
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
    // Preferred language wins; country is the fallback (best-effort).
    const language = resolveUserLanguage(ok(userRow) ?? {});

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

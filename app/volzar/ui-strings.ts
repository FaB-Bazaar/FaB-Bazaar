// Volzar page chrome in the user's language (country-derived, resolved
// server-side in page.tsx). CLIENT-SAFE on purpose: VolzarChat may not
// value-import from lib/ai/volzar-suggestions (ServiceFactory TDZ), so the
// UI dictionary lives here with a plain string language key.
//
// Product names (Decks to Beat, Flesh and Blood, Volzar) and the example
// card name stay in English everywhere.

export interface VolzarUiStrings {
  greeting: (username: string) => string;
  /** [before-⚡, after-⚡] — the explainer renders the Zap icon between them. */
  explainer: [string, string];
  placeholder: string;
  placeholderMobile: string;
  newChat: string;
  instantLabel: string;
  movers: { heading: string; seeAll: (n: number) => string };
  actions: {
    binders: string;
    wants: string;
    decks: string;
    results: string;
    daily: string;
    'to-beat': string;
    archetype: string;
    'hero-kit': string;
  };
}

export const UI_STRINGS: Record<string, VolzarUiStrings> = {
  en: {
    greeting: (u) => `Hey ${u} — ask me anything about Flesh and Blood.`,
    explainer: ['The', 'buttons above are instant and free — they open your lists directly. Chat when you want thinking: deck advice, searches, or “add 3 Command and Conquer to my binder”.'],
    placeholder: 'Ask Volzar… (Enter to send, Shift+Enter for a new line)',
    placeholderMobile: 'Ask Volzar…',
    newChat: 'New chat',
    instantLabel: 'Instant:',
    actions: {
      binders: 'My binders', wants: 'My wants', decks: 'My decks', results: 'Game results', daily: 'Daily movers',
      'to-beat': 'Decks to beat', archetype: 'Compare archetype', 'hero-kit': 'Hero kit',
    },
    movers: { heading: 'Today’s movers in your collection', seeAll: (n) => `All ${n} movers` },
  },
  fr: {
    greeting: (u) => `Salut ${u} — pose-moi toutes tes questions sur Flesh and Blood.`,
    explainer: ['Les boutons', 'ci-dessus sont instantanés et gratuits — ils ouvrent directement tes listes. Discute avec Volzar quand tu veux de la réflexion : conseils de deck, recherches, ou « ajoute 3 Command and Conquer à mon classeur ».'],
    placeholder: 'Demande à Volzar… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)',
    placeholderMobile: 'Demande à Volzar…',
    newChat: 'Nouvelle discussion',
    instantLabel: 'Instantané :',
    actions: {
      binders: 'Mes classeurs', wants: 'Mes recherches', decks: 'Mes decks', results: 'Résultats de parties', daily: 'Mouvements du jour',
      'to-beat': 'Decks to beat', archetype: 'Comparer un archétype', 'hero-kit': 'Kit de héros',
    },
    movers: { heading: 'Les mouvements du jour dans ta collection', seeAll: (n) => `Voir les ${n} mouvements` },
  },
  de: {
    greeting: (u) => `Hey ${u} — frag mich alles über Flesh and Blood.`,
    explainer: ['Die', 'Buttons oben sind sofort und kostenlos — sie öffnen deine Listen direkt. Chatte, wenn du Denkarbeit willst: Deck-Beratung, Suchen oder „füge 3 Command and Conquer zu meinem Ordner hinzu“.'],
    placeholder: 'Frag Volzar… (Enter zum Senden, Shift+Enter für neue Zeile)',
    placeholderMobile: 'Frag Volzar…',
    newChat: 'Neuer Chat',
    instantLabel: 'Sofort:',
    actions: {
      binders: 'Meine Ordner', wants: 'Meine Suchliste', decks: 'Meine Decks', results: 'Spielergebnisse', daily: 'Preisbewegungen',
      'to-beat': 'Decks to beat', archetype: 'Archetyp vergleichen', 'hero-kit': 'Helden-Kit',
    },
    movers: { heading: 'Heutige Preisbewegungen in deiner Sammlung', seeAll: (n) => `Alle ${n} Bewegungen` },
  },
  it: {
    greeting: (u) => `Ciao ${u} — chiedimi qualsiasi cosa su Flesh and Blood.`,
    explainer: ['I pulsanti', 'qui sopra sono istantanei e gratuiti — aprono direttamente le tue liste. Chatta quando vuoi ragionamento: consigli sul mazzo, ricerche, o «aggiungi 3 Command and Conquer al mio raccoglitore».'],
    placeholder: 'Chiedi a Volzar… (Invio per inviare, Maiusc+Invio per andare a capo)',
    placeholderMobile: 'Chiedi a Volzar…',
    newChat: 'Nuova chat',
    instantLabel: 'Istantaneo:',
    actions: {
      binders: 'I miei raccoglitori', wants: 'La mia lista desideri', decks: 'I miei mazzi', results: 'Risultati partite', daily: 'Movimenti del giorno',
      'to-beat': 'Decks to beat', archetype: 'Confronta archetipo', 'hero-kit': 'Kit eroe',
    },
    movers: { heading: 'I movimenti di oggi nella tua collezione', seeAll: (n) => `Tutti i ${n} movimenti` },
  },
  es: {
    greeting: (u) => `Hola ${u} — pregúntame lo que quieras sobre Flesh and Blood.`,
    explainer: ['Los botones', 'de arriba son instantáneos y gratis — abren tus listas directamente. Chatea cuando quieras razonamiento: consejos de mazo, búsquedas, o «añade 3 Command and Conquer a mi carpeta».'],
    placeholder: 'Pregunta a Volzar… (Enter para enviar, Shift+Enter para nueva línea)',
    placeholderMobile: 'Pregunta a Volzar…',
    newChat: 'Nuevo chat',
    instantLabel: 'Instantáneo:',
    actions: {
      binders: 'Mis carpetas', wants: 'Mi lista de deseos', decks: 'Mis mazos', results: 'Resultados de partidas', daily: 'Movimientos del día',
      'to-beat': 'Decks to beat', archetype: 'Comparar arquetipo', 'hero-kit': 'Kit de héroe',
    },
    movers: { heading: 'Los movimientos de hoy en tu colección', seeAll: (n) => `Ver los ${n} movimientos` },
  },
  ja: {
    greeting: (u) => `やあ、${u} — Flesh and Bloodのことなら何でも聞いて。`,
    explainer: ['上の', 'ボタンは即時・無料で、あなたのリストを直接開きます。考える作業が必要なとき（デッキ相談、検索、「Command and Conquerを3枚バインダーに追加」など）はチャットで。'],
    placeholder: 'Volzarに質問…（Enterで送信、Shift+Enterで改行）',
    placeholderMobile: 'Volzarに質問…',
    newChat: '新しいチャット',
    instantLabel: 'インスタント:',
    actions: {
      binders: 'マイバインダー', wants: 'ウォンツリスト', decks: 'マイデッキ', results: '対戦結果', daily: '本日の価格変動',
      'to-beat': 'Decks to beat', archetype: 'アーキタイプ比較', 'hero-kit': 'ヒーローキット',
    },
    movers: { heading: '今日のコレクション価格変動', seeAll: (n) => `変動${n}件をすべて見る` },
  },
  da: {
    greeting: (u) => `Hej ${u} — spørg mig om alt om Flesh and Blood.`,
    explainer: ['Knapperne med', 'ovenfor er øjeblikkelige og gratis — de åbner dine lister direkte. Chat når du vil have tænkning: deck-råd, søgninger, eller „tilføj 3 Command and Conquer til min mappe“.'],
    placeholder: 'Spørg Volzar… (Enter for at sende, Shift+Enter for ny linje)',
    placeholderMobile: 'Spørg Volzar…',
    newChat: 'Ny chat',
    instantLabel: 'Straks:',
    actions: {
      binders: 'Mine mapper', wants: 'Min ønskeliste', decks: 'Mine decks', results: 'Kampresultater', daily: 'Dagens bevægelser',
      'to-beat': 'Decks to beat', archetype: 'Sammenlign arketype', 'hero-kit': 'Helte-kit',
    },
    movers: { heading: 'Dagens prisbevægelser i din samling', seeAll: (n) => `Alle ${n} bevægelser` },
  },
  sv: {
    greeting: (u) => `Hej ${u} — fråga mig vad som helst om Flesh and Blood.`,
    explainer: ['Knapparna med', 'ovan är direkta och gratis — de öppnar dina listor direkt. Chatta när du vill ha tänkande: deck-råd, sökningar, eller „lägg till 3 Command and Conquer i min pärm“.'],
    placeholder: 'Fråga Volzar… (Enter för att skicka, Shift+Enter för ny rad)',
    placeholderMobile: 'Fråga Volzar…',
    newChat: 'Ny chatt',
    instantLabel: 'Direkt:',
    actions: {
      binders: 'Mina pärmar', wants: 'Min önskelista', decks: 'Mina decks', results: 'Matchresultat', daily: 'Dagens rörelser',
      'to-beat': 'Decks to beat', archetype: 'Jämför arketyp', 'hero-kit': 'Hjälte-kit',
    },
    movers: { heading: 'Dagens prisrörelser i din samling', seeAll: (n) => `Alla ${n} rörelser` },
  },
  ko: {
    greeting: (u) => `안녕하세요 ${u} — Flesh and Blood에 대해 무엇이든 물어보세요.`,
    explainer: ['위의', '버튼은 즉시 실행되며 무료입니다 — 리스트를 바로 열어 줍니다. 생각이 필요할 때는 채팅하세요: 덱 조언, 검색, 또는 “Command and Conquer 3장을 바인더에 추가”.'],
    placeholder: 'Volzar에게 질문… (Enter로 전송, Shift+Enter로 줄바꿈)',
    placeholderMobile: 'Volzar에게 질문…',
    newChat: '새 채팅',
    instantLabel: '인스턴트:',
    actions: {
      binders: '내 바인더', wants: '내 원츠 리스트', decks: '내 덱', results: '경기 결과', daily: '오늘의 가격 변동',
      'to-beat': 'Decks to beat', archetype: '아키타입 비교', 'hero-kit': '히어로 키트',
    },
    movers: { heading: '오늘 내 컬렉션의 가격 변동', seeAll: (n) => `변동 ${n}건 모두 보기` },
  },
  zh: {
    greeting: (u) => `嗨，${u} — 关于 Flesh and Blood 的问题都可以问我。`,
    explainer: ['上方的', '按钮即时且免费 — 直接打开你的列表。需要思考时再聊天：牌组建议、搜索，或“往我的卡册加 3 张 Command and Conquer”。'],
    placeholder: '问 Volzar…（Enter 发送，Shift+Enter 换行）',
    placeholderMobile: '问 Volzar…',
    newChat: '新对话',
    instantLabel: '即时:',
    actions: {
      binders: '我的卡册', wants: '我的愿望清单', decks: '我的牌组', results: '对局结果', daily: '今日价格变动',
      'to-beat': 'Decks to beat', archetype: '比较原型', 'hero-kit': '英雄套件',
    },
    movers: { heading: '今日你收藏中的价格变动', seeAll: (n) => `查看全部 ${n} 项变动` },
  },
  pt: {
    greeting: (u) => `Oi ${u} — pergunte-me qualquer coisa sobre Flesh and Blood.`,
    explainer: ['Os botões', 'acima são instantâneos e gratuitos — abrem suas listas diretamente. Converse quando quiser raciocínio: conselhos de deck, buscas, ou “adicione 3 Command and Conquer ao meu fichário”.'],
    placeholder: 'Pergunte ao Volzar… (Enter para enviar, Shift+Enter para nova linha)',
    placeholderMobile: 'Pergunte ao Volzar…',
    newChat: 'Novo chat',
    instantLabel: 'Instantâneo:',
    actions: {
      binders: 'Meus fichários', wants: 'Minha lista de desejos', decks: 'Meus decks', results: 'Resultados de partidas', daily: 'Movimentos do dia',
      'to-beat': 'Decks to beat', archetype: 'Comparar arquétipo', 'hero-kit': 'Kit de herói',
    },
    movers: { heading: 'Os movimentos de hoje na sua coleção', seeAll: (n) => `Todos os ${n} movimentos` },
  },
};

/** Picker options for the preferred-language setting (profile edit). */
export const SUPPORTED_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'da', label: 'Dansk' },
  { code: 'sv', label: 'Svenska' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文（简体）' },
];

/** Dictionary for a language code; unknown/missing → English. */
export function uiStrings(language?: string): VolzarUiStrings {
  return UI_STRINGS[language ?? 'en'] ?? UI_STRINGS.en;
}

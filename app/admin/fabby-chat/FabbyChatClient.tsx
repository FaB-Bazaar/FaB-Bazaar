'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Send, Square, RotateCcw, Zap, ExternalLink,
  Heart, FolderPlus, Copy, Check,
} from 'lucide-react';
import { fabbyChatClient, wantsClient, bindersClient } from '@/lib/client';
import { TcgAffiliateLink } from '@/components/tracking';
import type { AgentEvent, ChatMessage, ToolCall } from '@/lib/ai/types';
import {
  QUICK_ACTIONS, buildMessageWithContext, runDrill, parseSearchResults, harvestCardsFromStructured,
  fetchToBeatHeroes, runArchetypeConsensus, toShorthand,
  fetchToBeatEvents, runToBeatByHero, runToBeatByEvent, TO_BEAT_MONTHS,
  type CardLine, type CardPreview, type SearchResultsCard, type DrillTarget, type HarvestedCard, type ToBeatHero, type ToBeatEvent, type CardRow,
} from './quick-actions';
import { MarkdownMessage } from './MarkdownMessage';
import { buildCardNameIndex } from './card-linkify';
import { DeckCardsOverlay } from './DeckCardsOverlay';
import type { DeckViewCard } from '@/lib/deck/analytics';
import { LayoutGrid } from 'lucide-react';

/** Pitch pip icon (1/2/3) rendered inline after card names. */
function PitchIcon({ pitch }: { pitch?: number }) {
  if (!pitch || pitch < 1 || pitch > 3) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/pitch-${pitch}.png`}
      alt={`pitch ${pitch}`}
      className="inline-block h-3.5 w-auto ml-1 align-baseline"
    />
  );
}

const PITCH_GEM: Record<number, { bg: string; label: string }> = {
  1: { bg: 'bg-red-600', label: 'red' },
  2: { bg: 'bg-amber-400', label: 'yellow' },
  3: { bg: 'bg-blue-600', label: 'blue' },
};

/**
 * Leading pitch marker for a card line — a solid dot in the pitch color
 * (red/yellow/blue), so the left column reads as a scannable color stripe.
 * Non-pitched cards (equipment, hero) get a smaller neutral dot; title/aria
 * carry the pitch for non-visual users.
 */
function PitchGem({ pitch }: { pitch?: number }) {
  const gem = pitch && PITCH_GEM[pitch];
  return (
    <span className="w-5 shrink-0 inline-flex justify-center" aria-hidden={gem ? undefined : true}>
      {gem ? (
        <span
          title={`Pitch ${pitch} (${gem.label})`}
          aria-label={`pitch ${pitch}, ${gem.label}`}
          className={`inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${gem.bg}`}
        />
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
    </span>
  );
}

const FOIL_LABEL: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };

interface StructuredCard {
  title?: string;
  subtitle?: string;
  url?: string;
}

type UiItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; ms?: number; card?: StructuredCard; results?: SearchResultsCard; cards?: HarvestedCard[] }
  // Destructive tool call paused server-side awaiting Confirm/Deny.
  // pending → confirmed (tool_start arrives) or denied (failed tool_result
  // arrives without a tool_start). `submitting` disables the buttons while the
  // decision POST is in flight.
  | { kind: 'confirm'; id: string; name: string; args: unknown; status: 'pending' | 'confirmed' | 'denied'; submitting?: boolean }
  | { kind: 'data'; title: string; lines: CardLine[]; cards?: DeckViewCard[]; cardsSubtitle?: string; tableRows?: CardRow[]; copyHeader?: string; sourceUrl?: string };

// $/M-token prices for the session cost readout (mirrors the route allowlist;
// unknown models show token counts only).
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'openai/gpt-5-nano': { input: 0.05, output: 0.4 },
  'openai/gpt-oss-120b': { input: 0.03, output: 0.15 },
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  mock: { input: 0, output: 0 },
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

type RailStatus = { wants?: 'busy' | 'done' | 'error'; binder?: 'busy' | 'done' | 'error' };

/**
 * Card preview panel — image, prices, TCGplayer link, add-to-wants/binder.
 * Rendered in the desktop side rail (lg+) and inside the mobile bottom
 * drawer (tap a card name on touch), so both surfaces stay in sync.
 */
function CardPreviewPanel({ card, imageClassName = 'w-full rounded-md', railStatus, onAddToWants, onAddToBinder, binderOptions, targetBinderId, onTargetBinderChange }: {
  card: CardPreview;
  imageClassName?: string;
  railStatus: RailStatus;
  onAddToWants: () => void;
  onAddToBinder: () => void;
  binderOptions: Array<{ _id: string; name: string }>;
  targetBinderId: string;
  onTargetBinderChange: (id: string) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-border bg-card p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.imageUrl}
          alt={card.name}
          className={imageClassName}
        />
        <p className="mt-2 font-semibold text-center">{card.name}</p>
        {(card.priceLow !== undefined || card.priceMarket !== undefined) && (
          <div className="mt-1 flex justify-center gap-4 text-sm tabular-nums">
            {card.priceLow !== undefined && (
              <span>
                <span className="text-gray-600 dark:text-gray-300">Low </span>
                <span className="font-semibold text-green-700 dark:text-green-500">${card.priceLow.toFixed(2)}</span>
              </span>
            )}
            {card.priceMarket !== undefined && (
              <span>
                <span className="text-gray-600 dark:text-gray-300">Market </span>
                <span className="font-semibold text-green-700 dark:text-green-500">${card.priceMarket.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}
        {card.tcgplayerUrl && (
          <div className="text-sm mt-2 pt-2 border-t border-border">
            <TcgAffiliateLink
              tcgplayerUrl={card.tcgplayerUrl}
              feature="fabby-chat"
              className={`flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${focusRing} rounded-sm`}
              title="Purchase on TCGPlayer"
            >
              <span>Available for purchase here</span>
              {/* Theme-swapped wordmark: black for light mode, white (CDN) for dark */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tcgplayer-logo-black.png"
                alt="TCGPlayer"
                className="h-4 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                alt=""
                aria-hidden="true"
                className="h-4 w-auto hidden dark:block"
              />
            </TcgAffiliateLink>
          </div>
        )}
      </div>

      {card.printingId && (
        <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddToWants}
            disabled={railStatus.wants === 'busy' || railStatus.wants === 'done'}
            className={`justify-start gap-2 ${focusRing}`}
          >
            {railStatus.wants === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : railStatus.wants === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
              : railStatus.wants === 'error' ? <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
              : <Heart className="h-4 w-4" aria-hidden="true" />}
            {railStatus.wants === 'done' ? 'Added to wants' : 'Add to wants'}
          </Button>

          {binderOptions.length > 0 && (
            <>
              <Select value={targetBinderId} onValueChange={onTargetBinderChange}>
                <SelectTrigger className={`text-sm ${focusRing}`} aria-label="Target binder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {binderOptions.map((b) => (
                    <SelectItem key={b._id} value={b._id} className="text-sm">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddToBinder}
                disabled={!targetBinderId || railStatus.binder === 'busy' || railStatus.binder === 'done'}
                className={`justify-start gap-2 ${focusRing}`}
              >
                {railStatus.binder === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : railStatus.binder === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
                  : railStatus.binder === 'error' ? <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
                  : <FolderPlus className="h-4 w-4" aria-hidden="true" />}
                {railStatus.binder === 'done' ? 'Added to binder' : 'Add to binder'}
              </Button>
            </>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
            <Zap className="h-3 w-3" aria-hidden="true" /> Instant — no AI
          </p>
        </div>
      )}
    </>
  );
}

function toStructuredCard(structured: unknown): StructuredCard | undefined {
  if (!structured || typeof structured !== 'object') return undefined;
  const s = structured as Record<string, unknown>;
  // Only render http(s) links — closes javascript:/data: smuggling if a tool
  // ever reflects user-authored content into `url`.
  const url = typeof s.url === 'string' && /^https?:\/\//i.test(s.url) ? s.url : undefined;
  const card: StructuredCard = {
    title: typeof s.title === 'string' ? s.title : undefined,
    subtitle: typeof s.subtitle === 'string' ? s.subtitle : undefined,
    url,
  };
  return card.title || card.url ? card : undefined;
}

export function FabbyChatClient({ username, userId, mockMode, models, initialContext, initialData }: {
  username: string;
  userId: string;
  mockMode: boolean;
  models: string[];
  /** Pre-queued context (e.g. the Bridge B /opt handoff) — rides the
   *  pendingContext queue with the first free-text message, then clears.
   *  Also the seam a future embedded chat panel seeds. */
  initialContext?: string[];
  /** Visible data card announcing the queued context in the thread. */
  initialData?: { title: string; lines: CardLine[] };
}) {
  // Initializers (not effects) so StrictMode's double mount can't double-seed.
  const [items, setItems] = useState<UiItem[]>(() =>
    initialData ? [{ kind: 'data', title: initialData.title, lines: initialData.lines }] : []);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(models[0]);
  const [busy, setBusy] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  // Card preview: desktop side rail (hover/focus) or mobile bottom drawer (tap)
  const [previewCard, setPreviewCard] = useState<CardPreview | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const isMobile = useIsMobile();

  // Hover-capable devices preview in the rail; touch devices open the drawer
  // on tap (mouseenter/focus both fire on tap, so every card line works).
  const showPreview = useCallback((preview: CardPreview) => {
    setPreviewCard(preview);
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      setMobilePreviewOpen(true);
    }
  }, []);

  // "View as cards" grid overlay for a deck / consensus data card.
  const [deckView, setDeckView] = useState<{ title: string; subtitle?: string; cards: DeckViewCard[] } | null>(null);

  // Archetype comparison picker (instant, no-AI cross-deck consensus).
  const [archetypeOpen, setArchetypeOpen] = useState(false);
  const [heroes, setHeroes] = useState<ToBeatHero[]>([]);
  const [heroesLoading, setHeroesLoading] = useState(false);
  const [selectedHero, setSelectedHero] = useState('');
  const [archetypeMonths, setArchetypeMonths] = useState(3);

  // Decks-to-beat picker — the unscoped list is too long, so scope by hero
  // (rolling window) or by event before fetching.
  const [toBeatOpen, setToBeatOpen] = useState(false);
  const [toBeatMode, setToBeatMode] = useState<'hero' | 'event'>('hero');
  const [toBeatHero, setToBeatHero] = useState('');
  const [toBeatEvents, setToBeatEvents] = useState<ToBeatEvent[]>([]);
  const [toBeatEventsLoading, setToBeatEventsLoading] = useState(false);
  const [toBeatEvent, setToBeatEvent] = useState('');

  // Every card any search_printings call surfaced this session, keyed by name,
  // so card names in Fabby's markdown answers can hover-preview in the rail.
  const cardIndex = useMemo(() => {
    const cards: HarvestedCard[] = [];
    for (const it of items) {
      if (it.kind === 'tool' && it.cards) cards.push(...it.cards);
    }
    return buildCardNameIndex(cards);
  }, [items]);
  const previewsByPid = useMemo(() => {
    const m = new Map<string, CardPreview>();
    for (const entries of cardIndex.values()) {
      for (const e of entries) if (e.preview.printingId) m.set(e.preview.printingId, e.preview);
    }
    return m;
  }, [cardIndex]);
  // Rail actions: binder picker options + per-card action feedback
  const [binderOptions, setBinderOptions] = useState<Array<{ _id: string; name: string }>>([]);
  const [targetBinderId, setTargetBinderId] = useState<string>('');
  const [railStatus, setRailStatus] = useState<{ wants?: 'busy' | 'done' | 'error'; binder?: 'busy' | 'done' | 'error' }>({});
  // Cumulative session usage (accumulated from done events)
  const [sessionUsage, setSessionUsage] = useState({ input: 0, output: 0, cost: 0 });
  const modelRef = useRef(models[0]);
  useEffect(() => { modelRef.current = model; });
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // One instant call to populate the add-to-binder picker
    bindersClient.getUserBinders().then((result) => {
      if (result.success) {
        const binders = (result.data as any)?.binders ?? [];
        setBinderOptions(binders);
        if (binders.length > 0) setTargetBinderId(binders[0]._id);
      }
    });
  }, []);

  // New hovered card → fresh action states
  useEffect(() => {
    setRailStatus({});
  }, [previewCard?.printingId]);

  // Zero-token context queue: quick-action results wait here and ride along
  // with the NEXT free-text message, then clear. Tokens are spent only if an
  // AI question actually follows the button press.
  const pendingContextRef = useRef<string[]>(initialContext ?? []);

  // Working state for the in-flight AI turn
  const turnRef = useRef<{
    assistantText: string;
    toolCalls: ToolCall[];
    toolResults: Array<{ id: string; content: string }>;
  }>({ assistantText: '', toolCalls: [], toolResults: [] });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items]);

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'token':
        turnRef.current.assistantText += event.text;
        setItems((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.kind === 'assistant' && last.streaming) {
            next[next.length - 1] = { ...last, text: last.text + event.text };
          } else {
            next.push({ kind: 'assistant', text: event.text, streaming: true });
          }
          return next;
        });
        break;

      case 'confirmation_request':
        // The loop pushes this call into the assistant message whether it is
        // later confirmed or denied — mirror it now so the reconstructed
        // apiMessages stay consistent (tool_start dedupes below).
        turnRef.current.toolCalls.push({
          id: event.id,
          type: 'function',
          function: { name: event.name, arguments: JSON.stringify(event.args ?? {}) },
        });
        setItems((prev) => [...prev, { kind: 'confirm', id: event.id, name: event.name, args: event.args, status: 'pending' }]);
        break;

      case 'tool_start':
        if (!turnRef.current.toolCalls.some((c) => c.id === event.id)) {
          turnRef.current.toolCalls.push({
            id: event.id,
            type: 'function',
            function: { name: event.name, arguments: JSON.stringify(event.args ?? {}) },
          });
        }
        setItems((prev) => [
          ...prev.map((item) =>
            item.kind === 'confirm' && item.id === event.id ? { ...item, status: 'confirmed' as const } : item,
          ),
          { kind: 'tool', id: event.id, name: event.name, status: 'running' },
        ]);
        break;

      case 'tool_result': {
        turnRef.current.toolResults.push({
          id: event.id,
          content: event.ok ? event.content : `Error: ${event.content}`,
        });
        const card = toStructuredCard(event.structured);
        const results = parseSearchResults(event.structured) ?? undefined;
        // Every card any tool surfaced feeds the name→rail index for markdown
        // linkification — decks and binders too, not just searches.
        const cards = harvestCardsFromStructured(event.structured);
        setItems((prev) => prev.map((item) => {
          if (item.kind === 'tool' && item.id === event.id) {
            return { ...item, status: event.ok ? ('ok' as const) : ('error' as const), ms: event.ms, card, results, cards };
          }
          // A result landing on a still-pending confirm card is the deny path
          // (denied calls never get a tool_start).
          if (item.kind === 'confirm' && item.id === event.id && item.status === 'pending') {
            return { ...item, status: 'denied' as const };
          }
          return item;
        }));
        break;
      }

      case 'done':
      case 'error': {
        if (event.type === 'done' && event.usage) {
          const usage = event.usage;
          const price = MODEL_PRICES[modelRef.current];
          setSessionUsage((prev) => ({
            input: prev.input + usage.prompt_tokens,
            output: prev.output + usage.completion_tokens,
            cost: prev.cost + (price ? (usage.prompt_tokens * price.input + usage.completion_tokens * price.output) / 1e6 : 0),
          }));
        }
        const { assistantText, toolCalls, toolResults } = turnRef.current;
        setApiMessages((prev) => {
          const next = [...prev];
          if (toolCalls.length > 0) {
            next.push({ role: 'assistant', content: null, tool_calls: toolCalls });
            for (const result of toolResults) {
              next.push({ role: 'tool', tool_call_id: result.id, content: result.content });
            }
          }
          if (assistantText) {
            next.push({ role: 'assistant', content: assistantText });
          }
          return next;
        });
        setItems((prev) => prev.map((item) =>
          item.kind === 'assistant' && item.streaming ? { ...item, streaming: false } : item,
        ));
        if (event.type === 'error') setErrorBanner(event.message);
        break;
      }
    }
  }, []);

  const runInstant = useCallback(async (actionId: string, run: () => Promise<{ title: string; lines: CardLine[]; context: string; cards?: DeckViewCard[]; cardsSubtitle?: string; tableRows?: CardRow[]; copyHeader?: string }>) => {
    if (busy || runningAction) return;
    setErrorBanner(null);
    setRunningAction(actionId);
    try {
      const result = await run();
      // The shareable page URL for a wants list / a specific binder drill.
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app';
      const sourceUrl = actionId === 'wants'
        ? `${base}/wants/${userId}`
        : actionId.startsWith('binder:')
          ? `${base}/binder/${actionId.slice('binder:'.length)}`
          : undefined;
      setItems((prev) => [...prev, { kind: 'data', title: result.title, lines: result.lines, cards: result.cards, cardsSubtitle: result.cardsSubtitle, tableRows: result.tableRows, copyHeader: result.copyHeader, sourceUrl }]);
      pendingContextRef.current.push(result.context);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setRunningAction(null);
    }
  }, [busy, runningAction, userId]);

  // Copy a wants/binder card list as Discord-friendly shorthand + link.
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyList = useCallback((idx: number, header: string | undefined, rows: CardRow[], url?: string) => {
    const text = [
      header,
      ...rows.map(toShorthand),
      ...(url ? ['', url] : []),
    ].filter((l) => l !== undefined).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    });
  }, []);

  const runQuickAction = useCallback((actionId: string) => {
    const action = QUICK_ACTIONS.find((a) => a.id === actionId);
    if (action) void runInstant(action.id, action.run);
  }, [runInstant]);

  const drill = useCallback((target: DrillTarget) => {
    void runInstant(`${target.kind}:${target.id}`, () => runDrill(target));
  }, [runInstant]);

  // Shared hero list (Decks-to-Beat heroes) — used by both the archetype
  // picker and the decks-to-beat by-hero picker; loaded once on demand.
  const ensureHeroes = useCallback(async () => {
    if (heroes.length > 0 || heroesLoading) return;
    setHeroesLoading(true);
    try {
      const list = await fetchToBeatHeroes();
      setHeroes(list);
      if (list.length > 0) {
        setSelectedHero((h) => h || list[0].heroName);
        setToBeatHero((h) => h || list[0].heroName);
      }
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Failed to load heroes');
    } finally {
      setHeroesLoading(false);
    }
  }, [heroes.length, heroesLoading]);

  const toggleArchetype = useCallback(() => {
    const opening = !archetypeOpen;
    setArchetypeOpen(opening);
    if (opening) void ensureHeroes();
  }, [archetypeOpen, ensureHeroes]);

  const runArchetype = useCallback(() => {
    if (!selectedHero) return;
    void runInstant('archetype', () => runArchetypeConsensus(selectedHero, archetypeMonths));
  }, [selectedHero, archetypeMonths, runInstant]);

  const ensureToBeatEvents = useCallback(async () => {
    if (toBeatEvents.length > 0 || toBeatEventsLoading) return;
    setToBeatEventsLoading(true);
    try {
      const list = await fetchToBeatEvents();
      setToBeatEvents(list);
      if (list.length > 0) setToBeatEvent((e) => e || list[0].eventName);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setToBeatEventsLoading(false);
    }
  }, [toBeatEvents.length, toBeatEventsLoading]);

  const toggleToBeat = useCallback(() => {
    const opening = !toBeatOpen;
    setToBeatOpen(opening);
    if (opening) {
      void ensureHeroes();
      if (toBeatMode === 'event') void ensureToBeatEvents();
    }
  }, [toBeatOpen, toBeatMode, ensureHeroes, ensureToBeatEvents]);

  const setToBeatModeAndLoad = useCallback((mode: 'hero' | 'event') => {
    setToBeatMode(mode);
    if (mode === 'event') void ensureToBeatEvents();
  }, [ensureToBeatEvents]);

  const runToBeat = useCallback(() => {
    if (toBeatMode === 'hero') {
      if (!toBeatHero) return;
      const hero = heroes.find((h) => h.heroName === toBeatHero);
      void runInstant('to-beat', () => runToBeatByHero(toBeatHero, hero?.displayName ?? toBeatHero));
    } else {
      if (!toBeatEvent) return;
      void runInstant('to-beat', () => runToBeatByEvent(toBeatEvent));
    }
  }, [toBeatMode, toBeatHero, toBeatEvent, heroes, runInstant]);

  const performTurn = useCallback(async (messagesToSend: ChatMessage[], modelToUse: string) => {
    setErrorBanner(null);
    setBusy(true);
    turnRef.current = { assistantText: '', toolCalls: [], toolResults: [] };

    const abortController = new AbortController();
    abortRef.current = abortController;

    const result = await fabbyChatClient.streamChat({
      messages: messagesToSend,
      model: modelToUse,
      signal: abortController.signal,
      onEvent: handleEvent,
    });

    if (!result.success) setErrorBanner(result.error);
    setBusy(false);
    abortRef.current = null;
  }, [handleEvent]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setInput('');

    // Attach any queued quick-action context to this turn, then clear the
    // queue. The UI bubble shows only what the user typed.
    const content = buildMessageWithContext(pendingContextRef.current, text);
    pendingContextRef.current = [];

    const nextMessages: ChatMessage[] = [...apiMessages, { role: 'user', content }];
    setApiMessages(nextMessages);
    setItems((prev) => [...prev, { kind: 'user', text }]);

    await performTurn(nextMessages, model);
  }, [input, busy, apiMessages, model, performTurn]);

  // Re-run the last user turn (optionally on a different model): trims any
  // partial assistant/tool messages from the failed attempt so the payload
  // ends with the user message again (the route requires it).
  const retryLastTurn = useCallback(async (modelOverride?: string) => {
    if (busy) return;
    const lastUserIndex = apiMessages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex === -1) return;
    const trimmed = apiMessages.slice(0, lastUserIndex + 1);
    setApiMessages(trimmed);
    const useModel = modelOverride ?? model;
    if (modelOverride) setModel(modelOverride);
    await performTurn(trimmed, useModel);
  }, [busy, apiMessages, model, performTurn]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Confirm/Deny for a paused destructive tool call. The POST releases the
  // server-side agent loop; the outcome (tool_start or a declined tool_result)
  // arrives over the still-open stream, which is what flips the card's status.
  const decideConfirmation = useCallback(async (id: string, decision: 'confirm' | 'deny') => {
    setItems((prev) => prev.map((item) =>
      item.kind === 'confirm' && item.id === id ? { ...item, submitting: true } : item,
    ));
    const result = await fabbyChatClient.resolveConfirmation({ id, decision });
    if (!result.success) {
      setErrorBanner(result.error);
      setItems((prev) => prev.map((item) =>
        item.kind === 'confirm' && item.id === id ? { ...item, submitting: false } : item,
      ));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setApiMessages([]);
    setErrorBanner(null);
    setBusy(false);
    pendingContextRef.current = [];
    setSessionUsage({ input: 0, output: 0, cost: 0 });
  }, []);

  const addPreviewToWants = useCallback(async () => {
    if (!previewCard?.printingId) return;
    setRailStatus((s) => ({ ...s, wants: 'busy' }));
    const result = await wantsClient.addWantsItem(previewCard.printingId, 1);
    setRailStatus((s) => ({ ...s, wants: result.success ? 'done' : 'error' }));
    if (!result.success) setErrorBanner(result.error);
  }, [previewCard]);

  const addPreviewToBinder = useCallback(async () => {
    if (!previewCard?.printingId || !targetBinderId) return;
    setRailStatus((s) => ({ ...s, binder: 'busy' }));
    const result = await bindersClient.addCardsToBinder(targetBinderId, [
      { printingId: previewCard.printingId, quantity: 1 } as any,
    ]);
    setRailStatus((s) => ({ ...s, binder: result.success ? 'done' : 'error' }));
    if (!result.success) setErrorBanner(result.error);
  }, [previewCard, targetBinderId]);

  return (
    <div className="flex gap-4 items-stretch h-[calc(100dvh-11.75rem)] min-h-[24rem] sm:h-[calc(100vh-14rem)] sm:min-h-[28rem]">
    <Card className="flex-1 min-w-0 flex flex-col">
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-1 min-h-0">
        {/* Header row: model picker + reset on one line; badges wrap below */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select value={model} onValueChange={setModel} disabled={busy}>
              <SelectTrigger className={`flex-1 min-w-0 sm:w-64 sm:flex-none text-base ${focusRing}`} aria-label="Model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m} className="text-base">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className={`ml-auto shrink-0 gap-1.5 ${focusRing}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> New chat
            </Button>
          </div>
          {(mockMode || sessionUsage.input > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {mockMode && (
                <Badge className="gap-1.5 border-amber-500 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Mock mode — no API key configured
                </Badge>
              )}
              {sessionUsage.input > 0 && (
                <Badge variant="secondary" className="gap-1 font-normal tabular-nums" title="Cumulative LLM usage this chat">
                  {(sessionUsage.input / 1000).toFixed(1)}k in · {(sessionUsage.output / 1000).toFixed(1)}k out
                  {sessionUsage.cost > 0 && <> · ${sessionUsage.cost.toFixed(4)}</>}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick actions — deterministic reads, zero AI tokens. One scrollable
            strip on mobile (chips don't wrap); wraps normally at sm+. */}
        <div
          className="flex items-center gap-2 overflow-x-auto -mx-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-x-visible"
          role="group"
          aria-label="Instant actions (no AI)"
        >
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Instant:
          </span>
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="secondary"
              size="sm"
              disabled={busy || runningAction !== null}
              onClick={() => runQuickAction(action.id)}
              className={`shrink-0 gap-1.5 ${focusRing}`}
              title="Runs directly against your data — no AI involved"
            >
              {runningAction === action.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {action.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || runningAction !== null}
            onClick={toggleToBeat}
            aria-expanded={toBeatOpen}
            className={`shrink-0 gap-1.5 ${focusRing}`}
            title="Featured tournament decks, scoped by hero or event — no AI"
          >
            Decks to beat
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || runningAction !== null}
            onClick={toggleArchetype}
            aria-expanded={archetypeOpen}
            className={`shrink-0 gap-1.5 ${focusRing}`}
            title="Compare all Decks to Beat of a hero — deterministic, no AI"
          >
            Compare archetype
          </Button>
        </div>

        {/* Decks-to-beat picker — scope by hero (last N months) or by event */}
        {toBeatOpen && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 dark:bg-muted/10 p-3">
            <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
              Browse by
              <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Browse decks to beat by">
                {(['hero', 'event'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setToBeatModeAndLoad(mode)}
                    aria-pressed={toBeatMode === mode}
                    className={`px-3 py-1.5 text-sm ${focusRing} ${
                      toBeatMode === mode
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {toBeatMode === mode ? '✓ ' : ''}{mode === 'hero' ? 'Hero' : 'Event'}
                  </button>
                ))}
              </div>
            </div>
            {toBeatMode === 'hero' ? (
              <label className="flex w-full flex-col gap-1 text-xs text-gray-600 dark:text-gray-300 sm:w-auto">
                Hero (last {TO_BEAT_MONTHS} months)
                <select
                  value={toBeatHero}
                  onChange={(e) => setToBeatHero(e.target.value)}
                  disabled={heroesLoading}
                  className={`w-full sm:min-w-[16rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm ${focusRing}`}
                >
                  {heroesLoading && <option>Loading heroes…</option>}
                  {!heroesLoading && heroes.length === 0 && <option value="">No featured decks found</option>}
                  {heroes.map((h) => (
                    <option key={h.heroName} value={h.heroName}>
                      {h.displayName}{h.formats.length ? ` · ${h.formats.join('/')}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex w-full flex-col gap-1 text-xs text-gray-600 dark:text-gray-300 sm:w-auto">
                Event (last {TO_BEAT_MONTHS} months)
                <select
                  value={toBeatEvent}
                  onChange={(e) => setToBeatEvent(e.target.value)}
                  disabled={toBeatEventsLoading}
                  className={`w-full sm:min-w-[16rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm ${focusRing}`}
                >
                  {toBeatEventsLoading && <option>Loading events…</option>}
                  {!toBeatEventsLoading && toBeatEvents.length === 0 && <option value="">No events found</option>}
                  {toBeatEvents.map((e) => (
                    <option key={`${e.eventName}|${e.eventDate}`} value={e.eventName}>
                      {e.eventName} · {e.eventDate}{e.count ? ` · ${e.count} decks` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              size="sm"
              disabled={(toBeatMode === 'hero' ? !toBeatHero : !toBeatEvent) || busy || runningAction !== null}
              onClick={runToBeat}
              className={`gap-1.5 ${focusRing}`}
            >
              {runningAction === 'to-beat' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Show decks
            </Button>
          </div>
        )}

        {/* Archetype comparison picker — instant, no-AI cross-deck consensus */}
        {archetypeOpen && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 dark:bg-muted/10 p-3">
            <label className="flex w-full flex-col gap-1 text-xs text-gray-600 dark:text-gray-300 sm:w-auto">
              Hero (Decks to Beat)
              <select
                value={selectedHero}
                onChange={(e) => setSelectedHero(e.target.value)}
                disabled={heroesLoading}
                className={`w-full sm:min-w-[16rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm ${focusRing}`}
              >
                {heroesLoading && <option>Loading heroes…</option>}
                {!heroesLoading && heroes.length === 0 && <option value="">No featured decks found</option>}
                {heroes.map((h) => (
                  <option key={h.heroName} value={h.heroName}>
                    {h.displayName}{h.formats.length ? ` · ${h.formats.join('/')}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
              Window
              <select
                value={archetypeMonths}
                onChange={(e) => setArchetypeMonths(Number(e.target.value))}
                className={`rounded-md border border-border bg-background px-2 py-1.5 text-sm ${focusRing}`}
              >
                <option value={1}>Last 1 month</option>
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
            </label>
            <Button
              size="sm"
              disabled={!selectedHero || busy || runningAction !== null}
              onClick={runArchetype}
              className={`gap-1.5 ${focusRing}`}
            >
              {runningAction === 'archetype' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Compare
            </Button>
          </div>
        )}

        {/* Thread */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={`Chat with Fabby as ${username}`}
          className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-muted/30 dark:bg-muted/10 p-3 sm:p-4 flex flex-col gap-3"
        >
          {items.length === 0 && (
            <p className="text-gray-600 dark:text-gray-300 text-sm m-auto text-center max-w-sm">
              Use the ⚡ instant buttons for your lists, or ask Fabby something that needs thinking —
              searches, suggestions, adding cards.
              {mockMode && ' (Mock mode: AI replies follow a fixed script; binder questions show the tool loop.)'}
            </p>
          )}
          {items.map((item, index) => {
            if (item.kind === 'user') {
              return (
                <div key={index} className="self-end max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3.5 py-2 whitespace-pre-wrap">
                  {item.text}
                </div>
              );
            }
            if (item.kind === 'assistant') {
              return (
                <div key={index} className="self-start max-w-[85%] rounded-lg bg-card border border-border px-3.5 py-2">
                  <MarkdownMessage
                    text={item.text}
                    index={cardIndex}
                    previewsByPid={previewsByPid}
                    onHoverCard={showPreview}
                  />
                  {item.streaming && <span className="animate-pulse" aria-hidden="true">▍</span>}
                </div>
              );
            }
            if (item.kind === 'data') {
              return (
                <div key={index} className="self-start w-full max-w-full sm:max-w-[85%] rounded-lg border border-border bg-card px-3 py-2.5 sm:px-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="font-semibold min-w-0 truncate">{item.title}</span>
                    <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 shrink-0">· instant, no AI</span>
                    <div className="ml-auto shrink-0 flex items-center gap-1.5">
                      {item.tableRows && item.tableRows.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyList(index, item.copyHeader, item.tableRows!, item.sourceUrl)}
                            className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted ${focusRing}`}
                            title="Copy as text (for Discord / trade posts)"
                          >
                            {copiedIdx === index
                              ? <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />Copied</>
                              : <><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy</>}
                          </button>
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-muted ${focusRing}`}
                              title="Open on FaB Bazaar"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              Open
                            </a>
                          )}
                        </>
                      )}
                      {item.cards && item.cards.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeckView({ title: item.title, subtitle: item.cardsSubtitle, cards: item.cards! })}
                          className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-muted ${focusRing}`}
                          title="View these cards as a grid"
                        >
                          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                          View as cards
                        </button>
                      )}
                    </div>
                  </div>
                  {item.tableRows && item.tableRows.length > 0 && (
                    <div className="max-h-96 overflow-y-auto overflow-x-hidden">
                      <table className="w-full text-sm border-separate border-spacing-x-2 border-spacing-y-0.5">
                        <tbody>
                          {item.tableRows.map((r, i) => (
                            <tr key={i}>
                              <td className="align-middle w-5"><PitchGem pitch={r.pitch} /></td>
                              <td className="align-middle text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.qty}×</td>
                              <td className="align-middle break-words">
                                <span
                                  tabIndex={0}
                                  onMouseEnter={() => showPreview(r.preview)}
                                  onFocus={() => showPreview(r.preview)}
                                  onClick={() => showPreview(r.preview)}
                                  className={`cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                                >
                                  {r.name}
                                </span>
                                {r.extendedArt && <span className="ml-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400">EA</span>}
                                {r.marvel && <span className="ml-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Marvel</span>}
                              </td>
                              <td className="hidden sm:table-cell align-middle text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.collector ?? ''}</td>
                              <td className="hidden sm:table-cell align-middle text-xs text-gray-500 dark:text-gray-400">{r.foiling ? FOIL_LABEL[r.foiling] : ''}</td>
                              <td className="align-middle text-right text-xs tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">{typeof r.price === 'number' ? `$${r.price.toFixed(2)}` : ''}</td>
                              <td className="align-middle text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.forTrade ? 'trade' : r.priority ? r.priority : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Non-table results render as wrapping lines (min-w-0/break-words)
                      so nothing is clipped and all text stays available for the AI
                      context; overflow-auto scrolls only if a token exceeds width. */}
                  {!(item.tableRows && item.tableRows.length > 0) && (
                  <ul className={`text-sm max-h-96 overflow-y-auto overflow-x-hidden space-y-0.5 ${item.lines.length > 12 ? 'sm:columns-2 sm:gap-x-6' : ''}`}>
                    {item.lines.map((line, lineIndex) => {
                      if (typeof line === 'string') {
                        // Section headers ("— Maindeck (28) —") vs plain notes.
                        const isHeader = line.startsWith('—');
                        if (isHeader) {
                          return (
                            <li key={lineIndex} className="break-inside-avoid font-semibold text-gray-700 dark:text-gray-200 mt-1.5 first:mt-0 list-none">
                              {line}
                            </li>
                          );
                        }
                        // Non-header note (e.g. color summary): indent to align with card names.
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-baseline gap-1.5">
                            <span className="w-5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{line}</span>
                          </li>
                        );
                      }
                      if (line.drill) {
                        const target = line.drill;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                            <PitchGem pitch={line.pitch} />
                            <button
                              type="button"
                              onClick={() => drill(target)}
                              disabled={busy || runningAction !== null}
                              title={target.kind === 'deck-compare'
                                ? 'Compare this deck against your whole collection — instant, no AI'
                                : `Show contents of ${target.name} — instant, no AI`}
                              className={`min-w-0 break-words text-left underline underline-offset-2 text-blue-700 dark:text-blue-400 hover:text-blue-500 disabled:opacity-50 ${focusRing} rounded-sm`}
                            >
                              {line.text}
                            </button>
                          </li>
                        );
                      }
                      if (line.preview) {
                        const preview = line.preview;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                            <PitchGem pitch={line.pitch} />
                            <span
                              tabIndex={0}
                              onMouseEnter={() => showPreview(preview)}
                              onFocus={() => showPreview(preview)}
                              onClick={() => showPreview(preview)}
                              className={`min-w-0 break-words cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                            >
                              {line.text}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                          <PitchGem pitch={line.pitch} />
                          <span className="min-w-0 break-words">{line.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
              );
            }
            if (item.kind === 'confirm') {
              const argEntries = item.args && typeof item.args === 'object'
                ? Object.entries(item.args as Record<string, unknown>)
                : [];
              return (
                <div
                  key={index}
                  className="self-start w-full max-w-[85%] rounded-lg border border-amber-500/60 bg-amber-500/10 px-3.5 py-2.5"
                  role="group"
                  aria-label={`Confirmation required: ${item.name}`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    Fabby wants to run {item.name}
                  </div>
                  {argEntries.length > 0 && (
                    <dl className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      {argEntries.map(([key, value]) => (
                        <div key={key} className="flex gap-1.5">
                          <dt className="text-gray-600 dark:text-gray-300">{key}:</dt>
                          <dd className="font-mono break-all">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {item.status === 'pending' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={item.submitting}
                        onClick={() => decideConfirmation(item.id, 'confirm')}
                        className={`gap-1.5 ${focusRing}`}
                      >
                        {item.submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={item.submitting}
                        onClick={() => decideConfirmation(item.id, 'deny')}
                        className={focusRing}
                      >
                        Deny
                      </Button>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        This changes your collection — nothing runs until you decide.
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                      {item.status === 'confirmed' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
                          Confirmed
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
                          Denied — nothing was removed
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            // tool chip (+ optional structured card from the token-bypass channel)
            return (
              <div key={index} className="self-start flex flex-col gap-1.5">
                <Badge variant="secondary" className="gap-1.5 font-normal w-fit">
                  {item.status === 'running' && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Running {item.name}…
                    </>
                  )}
                  {item.status === 'ok' && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" aria-hidden="true" />
                      {item.name} · {item.ms}ms
                    </>
                  )}
                  {item.status === 'error' && (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" aria-hidden="true" />
                      {item.name} — failed
                    </>
                  )}
                </Badge>
                {(item.card || item.results) && (
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-sm w-full max-w-xl">
                    {item.card?.title && <div className="font-semibold">{item.card.title}</div>}
                    {item.card?.subtitle && <div className="text-gray-600 dark:text-gray-300">{item.card.subtitle}</div>}
                    {item.results && (
                      <ul className="mt-1.5 max-h-52 overflow-y-auto space-y-0.5">
                        {item.results.rows.map((row, rowIndex) => {
                          if (typeof row === 'string' || !row.preview) return <li key={rowIndex}>{typeof row === 'string' ? row : row.text}</li>;
                          const preview = row.preview;
                          return (
                            <li key={rowIndex}>
                              <span
                                tabIndex={0}
                                onMouseEnter={() => showPreview(preview)}
                                onFocus={() => showPreview(preview)}
                                onClick={() => showPreview(preview)}
                                className={`cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                              >
                                {row.text}
                                <PitchIcon pitch={row.pitch} />
                              </span>
                              {row.printingCount && row.printingCount > 1 && (
                                <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                                  +{row.printingCount - 1} {row.printingCount - 1 === 1 ? 'printing' : 'printings'}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {item.card?.url && (
                      <a
                        href={item.card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 underline underline-offset-2 mt-1.5 ${focusRing}`}
                      >
                        {item.results && item.results.total > item.results.shown
                          ? `+${item.results.total - item.results.shown} more — open in card search`
                          : 'Open in card search'}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Thinking indicator — covers the silence between tool results and
            the model's next tokens (streaming text has its own cursor) */}
        {busy
          && !(items.at(-1)?.kind === 'assistant' && (items.at(-1) as any).streaming)
          && !(items.at(-1)?.kind === 'confirm' && (items.at(-1) as any).status === 'pending') && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Waiting for {model}…
          </div>
        )}

        {/* Error banner with one-click recovery */}
        {errorBanner && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400" role="alert">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="text-sm break-words">
                {errorBanner.length > 220 ? `${errorBanner.slice(0, 220)}…` : errorBanner}
              </span>
              {!busy && apiMessages.some((m) => m.role === 'user') && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => retryLastTurn()} className={focusRing}>
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={isMobile ? 'Ask Fabby…' : 'Ask Fabby… (Enter to send, Shift+Enter for a new line)'}
            aria-label="Message Fabby"
            rows={2}
            disabled={busy}
            className={`text-base resize-none ${focusRing}`}
          />
          {busy ? (
            <Button variant="outline" onClick={stop} aria-label="Stop" className={`gap-1.5 ${focusRing}`}>
              <Square className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()} aria-label="Send" className={`gap-1.5 ${focusRing}`}>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Desktop card preview + action rail */}
    <div className="hidden lg:flex flex-col gap-3 w-64 shrink-0 overflow-y-auto">
      {previewCard ? (
        <CardPreviewPanel
          card={previewCard}
          railStatus={railStatus}
          onAddToWants={addPreviewToWants}
          onAddToBinder={addPreviewToBinder}
          binderOptions={binderOptions}
          targetBinderId={targetBinderId}
          onTargetBinderChange={setTargetBinderId}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Hover a card in a list to preview it here
        </div>
      )}
    </div>

    {/* Mobile card preview — bottom sheet, opened by tapping a card name */}
    <Drawer open={mobilePreviewOpen && !!previewCard} onOpenChange={setMobilePreviewOpen}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerTitle className="sr-only">{previewCard?.name ?? 'Card preview'}</DrawerTitle>
        {previewCard && (
          <div className="overflow-y-auto px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col gap-3">
            <CardPreviewPanel
              card={previewCard}
              imageClassName="max-h-[45dvh] w-auto mx-auto rounded-md"
              railStatus={railStatus}
              onAddToWants={addPreviewToWants}
              onAddToBinder={addPreviewToBinder}
              binderOptions={binderOptions}
              targetBinderId={targetBinderId}
              onTargetBinderChange={setTargetBinderId}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
    {deckView && (
      <DeckCardsOverlay title={deckView.title} subtitle={deckView.subtitle} cards={deckView.cards} onClose={() => setDeckView(null)} />
    )}
    </div>
  );
}

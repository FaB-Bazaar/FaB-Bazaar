'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Send, Square, RotateCcw, Zap, ExternalLink,
  Heart, FolderPlus,
} from 'lucide-react';
import { fabbyChatClient, wantsClient, bindersClient } from '@/lib/client';
import { TcgAffiliateLink } from '@/components/tracking';
import type { AgentEvent, ChatMessage, ToolCall } from '@/lib/ai/types';
import {
  QUICK_ACTIONS, buildMessageWithContext, runDrill, parseSearchResults,
  type CardLine, type CardPreview, type SearchResultsCard, type DrillTarget,
} from './quick-actions';

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

interface StructuredCard {
  title?: string;
  subtitle?: string;
  url?: string;
}

type UiItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; ms?: number; card?: StructuredCard; results?: SearchResultsCard }
  // Destructive tool call paused server-side awaiting Confirm/Deny.
  // pending → confirmed (tool_start arrives) or denied (failed tool_result
  // arrives without a tool_start). `submitting` disables the buttons while the
  // decision POST is in flight.
  | { kind: 'confirm'; id: string; name: string; args: unknown; status: 'pending' | 'confirmed' | 'denied'; submitting?: boolean }
  | { kind: 'data'; title: string; lines: CardLine[] };

// $/M-token prices for the session cost readout (mirrors the route allowlist;
// unknown models show token counts only).
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'openai/gpt-5-nano': { input: 0.05, output: 0.4 },
  'openai/gpt-oss-120b': { input: 0.03, output: 0.15 },
  'openai/gpt-oss-120b:free': { input: 0, output: 0 },
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  mock: { input: 0, output: 0 },
};

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

export function FabbyChatClient({ username, mockMode, models }: {
  username: string;
  mockMode: boolean;
  models: string[];
}) {
  const [items, setItems] = useState<UiItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(models[0]);
  const [busy, setBusy] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  // Desktop-only card preview rail (hover/focus on a card line shows it)
  const [previewCard, setPreviewCard] = useState<CardPreview | null>(null);
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
  const pendingContextRef = useRef<string[]>([]);

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
        setItems((prev) => prev.map((item) => {
          if (item.kind === 'tool' && item.id === event.id) {
            return { ...item, status: event.ok ? ('ok' as const) : ('error' as const), ms: event.ms, card, results };
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

  const runInstant = useCallback(async (actionId: string, run: () => Promise<{ title: string; lines: CardLine[]; context: string }>) => {
    if (busy || runningAction) return;
    setErrorBanner(null);
    setRunningAction(actionId);
    try {
      const result = await run();
      setItems((prev) => [...prev, { kind: 'data', title: result.title, lines: result.lines }]);
      pendingContextRef.current.push(result.context);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setRunningAction(null);
    }
  }, [busy, runningAction]);

  const runQuickAction = useCallback((actionId: string) => {
    const action = QUICK_ACTIONS.find((a) => a.id === actionId);
    if (action) void runInstant(action.id, action.run);
  }, [runInstant]);

  const drill = useCallback((target: DrillTarget) => {
    void runInstant(`${target.kind}:${target.id}`, () => runDrill(target));
  }, [runInstant]);

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

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

  return (
    <div className="flex gap-4 items-stretch h-[calc(100vh-14rem)] min-h-[28rem]">
    <Card className="flex-1 min-w-0 flex flex-col">
      <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
        {/* Header row: model picker + mode badge + reset */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={model} onValueChange={setModel} disabled={busy}>
            <SelectTrigger className={`w-64 text-base ${focusRing}`} aria-label="Model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m} className="text-base">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mockMode && (
            <Badge variant="outline" className="gap-1.5 border-amber-500 text-amber-700 dark:text-amber-400">
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
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className={`ml-auto gap-1.5 ${focusRing}`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> New chat
          </Button>
        </div>

        {/* Quick actions — deterministic reads, zero AI tokens */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Instant actions (no AI)">
          <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Instant:
          </span>
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="secondary"
              size="sm"
              disabled={busy || runningAction !== null}
              onClick={() => runQuickAction(action.id)}
              className={`gap-1.5 ${focusRing}`}
              title="Runs directly against your data — no AI involved"
            >
              {runningAction === action.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {action.label}
            </Button>
          ))}
        </div>

        {/* Thread */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={`Chat with Fabby as ${username}`}
          className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-muted/30 dark:bg-muted/10 p-4 flex flex-col gap-3"
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
                <div key={index} className="self-start max-w-[85%] rounded-lg bg-card border border-border px-3.5 py-2 whitespace-pre-wrap">
                  {item.text}
                  {item.streaming && <span className="animate-pulse" aria-hidden="true">▍</span>}
                </div>
              );
            }
            if (item.kind === 'data') {
              return (
                <div key={index} className="self-start w-full max-w-[85%] rounded-lg border border-border bg-card px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">· instant, no AI</span>
                  </div>
                  <ul className={`text-sm max-h-72 overflow-y-auto space-y-0.5 ${item.lines.length > 12 ? 'sm:columns-2 sm:gap-x-6' : ''}`}>
                    {item.lines.map((line, lineIndex) => {
                      if (typeof line === 'string') {
                        // Section headers ("— Maindeck (28) —") vs plain notes
                        const isHeader = line.startsWith('—');
                        return (
                          <li key={lineIndex} className={`break-inside-avoid ${isHeader ? 'font-semibold text-gray-700 dark:text-gray-200 mt-1.5 first:mt-0 list-none' : 'list-disc list-inside'}`}>
                            {line}
                          </li>
                        );
                      }
                      if (line.drill) {
                        const target = line.drill;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-disc list-inside">
                            <button
                              type="button"
                              onClick={() => drill(target)}
                              disabled={busy || runningAction !== null}
                              title={target.kind === 'deck-compare'
                                ? 'Compare this deck against your whole collection — instant, no AI'
                                : `Show contents of ${target.name} — instant, no AI`}
                              className={`underline underline-offset-2 text-blue-700 dark:text-blue-400 hover:text-blue-500 disabled:opacity-50 ${focusRing} rounded-sm`}
                            >
                              {line.text}
                            </button>
                          </li>
                        );
                      }
                      if (line.preview) {
                        const preview = line.preview;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-disc list-inside">
                            <span
                              tabIndex={0}
                              onMouseEnter={() => setPreviewCard(preview)}
                              onFocus={() => setPreviewCard(preview)}
                              className={`cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                            >
                              {line.text}
                              <PitchIcon pitch={line.pitch} />
                            </span>
                          </li>
                        );
                      }
                      return <li key={lineIndex} className="break-inside-avoid list-disc list-inside">{line.text}<PitchIcon pitch={line.pitch} /></li>;
                    })}
                  </ul>
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
                                onMouseEnter={() => setPreviewCard(preview)}
                                onFocus={() => setPreviewCard(preview)}
                                className={`cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                              >
                                {row.text}
                                <PitchIcon pitch={row.pitch} />
                              </span>
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
                  {model.endsWith(':free') && /429|rate.?limit/i.test(errorBanner) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryLastTurn(model.replace(':free', ''))}
                      className={focusRing}
                      title="The free tier is rate-limited upstream — the paid variant costs ~$0.03/M tokens"
                    >
                      Switch to {model.replace(':free', '')} & retry
                    </Button>
                  )}
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
            placeholder="Ask Fabby… (Enter to send, Shift+Enter for a new line)"
            aria-label="Message Fabby"
            rows={2}
            disabled={busy}
            className={`text-base resize-none ${focusRing}`}
          />
          {busy ? (
            <Button variant="outline" onClick={stop} className={`gap-1.5 ${focusRing}`}>
              <Square className="h-4 w-4" aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()} className={`gap-1.5 ${focusRing}`}>
              <Send className="h-4 w-4" aria-hidden="true" /> Send
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Desktop card preview + action rail */}
    <div className="hidden lg:flex flex-col gap-3 w-64 shrink-0 overflow-y-auto">
      {previewCard ? (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewCard.imageUrl}
              alt={previewCard.name}
              className="w-full rounded-md"
            />
            <p className="mt-2 font-semibold text-center">{previewCard.name}</p>
            {(previewCard.priceLow !== undefined || previewCard.priceMarket !== undefined) && (
              <div className="mt-1 flex justify-center gap-4 text-sm tabular-nums">
                {previewCard.priceLow !== undefined && (
                  <span>
                    <span className="text-gray-600 dark:text-gray-300">Low </span>
                    <span className="font-semibold text-green-700 dark:text-green-500">${previewCard.priceLow.toFixed(2)}</span>
                  </span>
                )}
                {previewCard.priceMarket !== undefined && (
                  <span>
                    <span className="text-gray-600 dark:text-gray-300">Market </span>
                    <span className="font-semibold text-green-700 dark:text-green-500">${previewCard.priceMarket.toFixed(2)}</span>
                  </span>
                )}
              </div>
            )}
            {previewCard.tcgplayerUrl && (
              <div className="text-sm mt-2 pt-2 border-t border-border">
                <TcgAffiliateLink
                  tcgplayerUrl={previewCard.tcgplayerUrl}
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

          {previewCard.printingId && (
            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addPreviewToWants}
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
                  <Select value={targetBinderId} onValueChange={setTargetBinderId}>
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
                    onClick={addPreviewToBinder}
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
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Hover a card in a list to preview it here
        </div>
      )}
    </div>
    </div>
  );
}

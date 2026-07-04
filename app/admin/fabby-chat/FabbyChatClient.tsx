'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Send, Square, RotateCcw } from 'lucide-react';
import { fabbyChatClient } from '@/lib/client';
import type { AgentEvent, ChatMessage, ToolCall } from '@/lib/ai/types';

type UiItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; ms?: number };

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
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Working state for the in-flight turn (kept in refs to avoid re-render races)
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

      case 'tool_start':
        turnRef.current.toolCalls.push({
          id: event.id,
          type: 'function',
          function: { name: event.name, arguments: JSON.stringify(event.args ?? {}) },
        });
        setItems((prev) => [...prev, { kind: 'tool', id: event.id, name: event.name, status: 'running' }]);
        break;

      case 'tool_result': {
        turnRef.current.toolResults.push({
          id: event.id,
          content: event.ok ? event.content : `Error: ${event.content}`,
        });
        setItems((prev) => prev.map((item) =>
          item.kind === 'tool' && item.id === event.id
            ? { ...item, status: event.ok ? 'ok' : 'error', ms: event.ms }
            : item,
        ));
        break;
      }

      case 'done':
      case 'error': {
        // Rebuild the OpenAI-format history for the next turn: assistant
        // tool_calls messages + tool results + final assistant text.
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

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setErrorBanner(null);
    setInput('');
    setBusy(true);
    turnRef.current = { assistantText: '', toolCalls: [], toolResults: [] };

    const nextMessages: ChatMessage[] = [...apiMessages, { role: 'user', content: text }];
    setApiMessages(nextMessages);
    setItems((prev) => [...prev, { kind: 'user', text }]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const result = await fabbyChatClient.streamChat({
      messages: nextMessages,
      model,
      signal: abortController.signal,
      onEvent: handleEvent,
    });

    if (!result.success) setErrorBanner(result.error);
    setBusy(false);
    abortRef.current = null;
  }, [input, busy, apiMessages, model, handleEvent]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setApiMessages([]);
    setErrorBanner(null);
    setBusy(false);
  }, []);

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-4">
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
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className={`ml-auto gap-1.5 ${focusRing}`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> New chat
          </Button>
        </div>

        {/* Thread */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={`Chat with Fabby as ${username}`}
          className="h-[28rem] overflow-y-auto rounded-md border border-border bg-muted/30 dark:bg-muted/10 p-4 flex flex-col gap-3"
        >
          {items.length === 0 && (
            <p className="text-gray-600 dark:text-gray-300 text-sm m-auto text-center max-w-sm">
              Ask about your collection — try &ldquo;what binders do I have?&rdquo;
              {mockMode && ' (mock mode follows a fixed script; binder questions show the full tool loop)'}
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
            return (
              <div key={index} className="self-start">
                <Badge variant="secondary" className="gap-1.5 font-normal">
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
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {errorBanner && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400" role="alert">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="text-sm">{errorBanner}</span>
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
            placeholder="Message Fabby… (Enter to send, Shift+Enter for a new line)"
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
  );
}

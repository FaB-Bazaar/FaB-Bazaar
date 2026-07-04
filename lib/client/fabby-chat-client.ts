// Client service for the hosted Fabby chat (superadmin prototype).
// Streams AgentEvents from POST /api/admin/fabby-chat via fetch + reader
// (EventSource can't POST, so we parse SSE data-frames ourselves).

import type { AgentEvent, ChatMessage, ConfirmationDecision } from '@/lib/ai/types';
import type { ApiResponse } from './types';

/**
 * Pure SSE frame parser: extracts complete `data: {json}\n\n` frames from a
 * buffer, returns parsed events plus the unconsumed remainder. Malformed
 * frames are skipped.
 */
export function parseSseFrames(buffer: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  let rest = buffer;
  let separatorIndex: number;

  while ((separatorIndex = rest.indexOf('\n\n')) !== -1) {
    const frame = rest.slice(0, separatorIndex);
    rest = rest.slice(separatorIndex + 2);
    if (!frame.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(frame.slice(6)));
    } catch {
      // skip malformed frame
    }
  }
  return { events, rest };
}

/**
 * Send a chat turn and stream events back. Resolves when the stream closes.
 * The caller receives every AgentEvent via onEvent (including the terminal
 * done/error); network/HTTP failures resolve as ApiResponse errors.
 */
export async function streamChat(opts: {
  messages: ChatMessage[];
  model: string;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}): Promise<ApiResponse<void>> {
  try {
    const response = await fetch('/api/admin/fabby-chat', {
      method: 'POST',
      credentials: 'include',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: opts.messages, model: opts.model }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { success: false, error: body.error || `Request failed (HTTP ${response.status})` };
    }
    if (!response.body) {
      return { success: false, error: 'Streaming not supported by this browser' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseFrames(buffer);
      buffer = rest;
      for (const event of events) opts.onEvent(event);
    }
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: true, data: undefined }; // user hit Stop — not an error
    }
    return { success: false, error: error instanceof Error ? error.message : 'Chat request failed' };
  }
}

/**
 * Resolve a paused destructive tool call (confirmation_request event) with the
 * user's decision. The server releases the waiting agent loop; the outcome
 * then arrives over the still-open chat stream.
 */
export async function resolveConfirmation(opts: {
  id: string;
  decision: ConfirmationDecision;
}): Promise<ApiResponse<{ resolved: boolean }>> {
  try {
    const response = await fetch('/api/admin/fabby-chat/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: opts.id, decision: opts.decision }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: body.error || `Request failed (HTTP ${response.status})` };
    }
    return { success: true, data: body.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Confirmation failed' };
  }
}

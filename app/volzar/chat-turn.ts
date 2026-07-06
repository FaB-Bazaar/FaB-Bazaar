// Pure helpers for the chat turn lifecycle (unit-tested in chat-turn.test.ts).

import type { ChatMessage, ToolCall } from '@/lib/ai/types';

/** Working state accumulated while a turn streams (VolzarChat's turnRef). */
export interface TurnState {
  assistantText: string;
  toolCalls: ToolCall[];
  toolResults: Array<{ id: string; content: string }>;
}

/**
 * Convert an (possibly interrupted) in-flight turn into API history messages.
 * Tool calls are paired with their results by id; a dangling call — aborted
 * mid-execution, or a confirmation the user never resolved — is dropped, so
 * the reconstructed history never contains a tool_call without its matching
 * tool message (which OpenAI-compatible APIs reject on the next request).
 */
export function buildTurnMessages(turn: TurnState): ChatMessage[] {
  const resultById = new Map(turn.toolResults.map((r) => [r.id, r.content]));
  const completedCalls = turn.toolCalls.filter((c) => resultById.has(c.id));

  const messages: ChatMessage[] = [];
  if (completedCalls.length > 0) {
    messages.push({ role: 'assistant', content: null, tool_calls: completedCalls });
    for (const c of completedCalls) {
      messages.push({ role: 'tool', tool_call_id: c.id, content: resultById.get(c.id)! });
    }
  }
  if (turn.assistantText) {
    messages.push({ role: 'assistant', content: turn.assistantText });
  }
  return messages;
}

/**
 * Composer Enter-to-send guard: plain Enter sends; Shift+Enter inserts a
 * newline; Enter during IME composition (isComposing, or the legacy keyCode
 * 229 some browsers report) confirms the composition and must NOT send.
 */
export function shouldSendOnEnter(e: {
  key: string;
  shiftKey: boolean;
  nativeEvent: { isComposing?: boolean; keyCode?: number };
}): boolean {
  return e.key === 'Enter'
    && !e.shiftKey
    && !e.nativeEvent.isComposing
    && e.nativeEvent.keyCode !== 229;
}

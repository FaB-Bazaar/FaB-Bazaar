// Pure helpers for finalizing an in-flight chat turn (chat-turn.ts):
//  - buildTurnMessages: turn working state → API history messages, dropping
//    dangling tool calls (aborted mid-call / never-resolved confirmations)
//    so the reconstructed history is always valid for the next request.
//  - shouldSendOnEnter: composer Enter-to-send guard (Shift+Enter newline,
//    IME composition never sends).

import { describe, it, expect } from 'vitest';
import { buildTurnMessages, shouldSendOnEnter } from './chat-turn';
import type { ToolCall } from '@/lib/ai/types';

const call = (id: string, name = 'search_printings'): ToolCall => ({
  id,
  type: 'function',
  function: { name, arguments: '{}' },
});

describe('buildTurnMessages', () => {
  it('returns nothing for an empty turn', () => {
    expect(buildTurnMessages({ assistantText: '', toolCalls: [], toolResults: [] })).toEqual([]);
  });

  it('emits a single assistant message for a text-only turn', () => {
    expect(buildTurnMessages({ assistantText: 'Hello!', toolCalls: [], toolResults: [] })).toEqual([
      { role: 'assistant', content: 'Hello!' },
    ]);
  });

  it('emits tool_calls + tool results + final text for a complete turn', () => {
    const turn = {
      assistantText: 'Found it.',
      toolCalls: [call('a'), call('b')],
      toolResults: [
        { id: 'a', content: 'result a' },
        { id: 'b', content: 'Error: declined' },
      ],
    };
    expect(buildTurnMessages(turn)).toEqual([
      { role: 'assistant', content: null, tool_calls: [call('a'), call('b')] },
      { role: 'tool', tool_call_id: 'a', content: 'result a' },
      { role: 'tool', tool_call_id: 'b', content: 'Error: declined' },
      { role: 'assistant', content: 'Found it.' },
    ]);
  });

  it('drops a dangling tool call (no result — aborted mid-call or unresolved confirmation)', () => {
    const turn = {
      assistantText: 'Partial answer…',
      toolCalls: [call('done-call'), call('dangling-call')],
      toolResults: [{ id: 'done-call', content: 'ok' }],
    };
    expect(buildTurnMessages(turn)).toEqual([
      { role: 'assistant', content: null, tool_calls: [call('done-call')] },
      { role: 'tool', tool_call_id: 'done-call', content: 'ok' },
      { role: 'assistant', content: 'Partial answer…' },
    ]);
  });

  it('emits no tool_calls message when every call is dangling', () => {
    const turn = {
      assistantText: 'Stopped before the tool ran.',
      toolCalls: [call('dangling-call')],
      toolResults: [],
    };
    expect(buildTurnMessages(turn)).toEqual([
      { role: 'assistant', content: 'Stopped before the tool ran.' },
    ]);
  });

  it('drops a result whose call is unknown (defensive)', () => {
    const turn = {
      assistantText: '',
      toolCalls: [],
      toolResults: [{ id: 'ghost', content: 'orphan' }],
    };
    expect(buildTurnMessages(turn)).toEqual([]);
  });
});

describe('shouldSendOnEnter', () => {
  const event = (over: Partial<{ key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }> = {}) => ({
    key: over.key ?? 'Enter',
    shiftKey: over.shiftKey ?? false,
    nativeEvent: { isComposing: over.isComposing ?? false, keyCode: over.keyCode ?? 13 },
  });

  it('sends on a plain Enter', () => {
    expect(shouldSendOnEnter(event())).toBe(true);
  });

  it('does not send on Shift+Enter (newline)', () => {
    expect(shouldSendOnEnter(event({ shiftKey: true }))).toBe(false);
  });

  it('does not send while an IME composition is active', () => {
    expect(shouldSendOnEnter(event({ isComposing: true }))).toBe(false);
  });

  it('does not send on the legacy IME keyCode 229', () => {
    expect(shouldSendOnEnter(event({ keyCode: 229 }))).toBe(false);
  });

  it('ignores other keys', () => {
    expect(shouldSendOnEnter(event({ key: 'a' }))).toBe(false);
  });
});

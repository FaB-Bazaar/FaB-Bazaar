/**
 * Unit tests for the hosted-chat agent loop — pure orchestration over an
 * injected LLM generator and tool executor. No HTTP, no Next, no DB.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AgentEvent, ChatMessage, Llm, LlmDelta, OpenAiTool, ToolCall } from './types';
import { runAgentLoop } from './agent-loop';

const TOOLS: OpenAiTool[] = [
  { type: 'function', function: { name: 'list_binders', description: 'd', parameters: {} } },
];

const call = (id: string, name: string, args = '{}'): ToolCall => ({
  id,
  type: 'function',
  function: { name, arguments: args },
});

/** Builds an Llm that plays one scripted generator per invocation, in order. */
function scriptedLlm(...turns: LlmDelta[][]): { llm: Llm; calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  const llm: Llm = async function* ({ messages }) {
    calls.push(JSON.parse(JSON.stringify(messages)));
    const turn = turns[calls.length - 1];
    if (!turn) throw new Error('scripted llm exhausted');
    for (const delta of turn) yield delta;
  };
  return { llm, calls };
}

async function collect(opts: {
  llm: Llm;
  messages?: ChatMessage[];
  executeTool?: (c: { name: string; args: unknown }) => Promise<{ ok: boolean; content: string }>;
  maxIterations?: number;
  signal?: AbortSignal;
}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  await runAgentLoop({
    messages: opts.messages ?? [{ role: 'user', content: 'hi' }],
    tools: TOOLS,
    llm: opts.llm,
    executeTool: opts.executeTool ?? (async () => ({ ok: true, content: 'ok' })),
    maxIterations: opts.maxIterations,
    signal: opts.signal,
    onEvent: (e) => events.push(e),
  });
  return events;
}

function terminals(events: AgentEvent[]): AgentEvent[] {
  return events.filter((e) => e.type === 'done' || e.type === 'error');
}

describe('runAgentLoop', () => {
  it('streams a text-only turn: token events then exactly one done', async () => {
    const { llm } = scriptedLlm([
      { kind: 'text', text: 'Hello ' },
      { kind: 'text', text: 'there' },
      { kind: 'usage', usage: { prompt_tokens: 10, completion_tokens: 2 } },
      { kind: 'finish', reason: 'stop' },
    ]);
    const events = await collect({ llm });

    expect(events.map((e) => e.type)).toEqual(['token', 'token', 'done']);
    expect(events[0]).toEqual({ type: 'token', text: 'Hello ' });
    const done = events.at(-1) as Extract<AgentEvent, { type: 'done' }>;
    expect(done.usage).toEqual({ prompt_tokens: 10, completion_tokens: 2 });
    expect(done.iterations).toBe(1);
  });

  it('runs a tool round-trip and threads messages back to the LLM', async () => {
    const { llm, calls } = scriptedLlm(
      [
        { kind: 'text', text: 'Checking…' },
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [
        { kind: 'text', text: 'You have 9 binders.' },
        { kind: 'finish', reason: 'stop' },
      ],
    );
    const executeTool = vi.fn().mockResolvedValue({ ok: true, content: 'BINDER LIST' });
    const events = await collect({ llm, executeTool });

    expect(events.map((e) => e.type)).toEqual(['token', 'tool_start', 'tool_result', 'token', 'done']);
    const result = events[2] as Extract<AgentEvent, { type: 'tool_result' }>;
    expect(result).toMatchObject({ id: 'c1', name: 'list_binders', ok: true, content: 'BINDER LIST' });
    expect(typeof result.ms).toBe('number');

    // Second LLM call sees the assistant tool_calls message and the tool result
    const second = calls[1];
    const assistant = second.find((m) => m.role === 'assistant') as any;
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.content).toBe('Checking…');
    const toolMsg = second.find((m) => m.role === 'tool') as any;
    expect(toolMsg).toMatchObject({ tool_call_id: 'c1', content: 'BINDER LIST' });
    const done = events.at(-1) as Extract<AgentEvent, { type: 'done' }>;
    expect(done.iterations).toBe(2);
  });

  it('executes multiple tool calls in one round sequentially, in order', async () => {
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('a', 'list_binders'), call('b', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'finish', reason: 'stop' }],
    );
    const order: string[] = [];
    const executeTool = vi.fn(async ({ name }: { name: string; args: unknown }) => {
      order.push(name);
      return { ok: true, content: `done-${order.length}` };
    });
    const events = await collect({ llm, executeTool });

    const ids = events.filter((e) => e.type === 'tool_start').map((e: any) => e.id);
    expect(ids).toEqual(['a', 'b']);
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failed tool to the LLM as an Error-prefixed tool message and continues', async () => {
    const { llm, calls } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'text', text: 'sorry' }, { kind: 'finish', reason: 'stop' }],
    );
    const executeTool = vi.fn().mockResolvedValue({ ok: false, content: 'binder not found' });
    const events = await collect({ llm, executeTool });

    const result = events.find((e) => e.type === 'tool_result') as any;
    expect(result.ok).toBe(false);
    const toolMsg = calls[1].find((m) => m.role === 'tool') as any;
    expect(toolMsg.content).toMatch(/^Error: binder not found/);
    expect(terminals(events)).toEqual([{ type: 'done', usage: undefined, iterations: 2 }]);
  });

  it('treats a thrown executeTool as a failed result, not a crash', async () => {
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'finish', reason: 'stop' }],
    );
    const executeTool = vi.fn().mockRejectedValue(new Error('boom'));
    const events = await collect({ llm, executeTool });

    const result = events.find((e) => e.type === 'tool_result') as any;
    expect(result).toMatchObject({ ok: false });
    expect(result.content).toContain('boom');
    expect(terminals(events)).toHaveLength(1);
    expect(terminals(events)[0].type).toBe('done');
  });

  it('rejects invalid JSON arguments without executing the tool', async () => {
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders', '{oops')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'finish', reason: 'stop' }],
    );
    const executeTool = vi.fn();
    const events = await collect({ llm, executeTool });

    expect(executeTool).not.toHaveBeenCalled();
    const result = events.find((e) => e.type === 'tool_result') as any;
    expect(result.ok).toBe(false);
    expect(result.content).toMatch(/invalid json/i);
  });

  it('treats empty-string arguments as {}', async () => {
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders', '')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'finish', reason: 'stop' }],
    );
    const executeTool = vi.fn().mockResolvedValue({ ok: true, content: 'ok' });
    await collect({ llm, executeTool });
    expect(executeTool).toHaveBeenCalledWith(expect.objectContaining({ args: {} }));
  });

  it('stops with a terminal error when the iteration cap is hit while tools are still requested', async () => {
    const toolTurn: LlmDelta[] = [
      { kind: 'tool_calls', toolCalls: [call('x', 'list_binders')] },
      { kind: 'finish', reason: 'tool_calls' },
    ];
    const { llm } = scriptedLlm(toolTurn, toolTurn, toolTurn);
    const events = await collect({ llm, maxIterations: 3 });

    const last = events.at(-1)!;
    expect(last.type).toBe('error');
    expect((last as any).message).toMatch(/limit/i);
    expect(terminals(events)).toHaveLength(1);
  });

  it('emits a truncation notice then done on finish reason length', async () => {
    const { llm } = scriptedLlm([
      { kind: 'text', text: 'partial' },
      { kind: 'finish', reason: 'length' },
    ]);
    const events = await collect({ llm });

    const texts = events.filter((e) => e.type === 'token').map((e: any) => e.text);
    expect(texts.join('')).toMatch(/truncated/i);
    expect(events.at(-1)!.type).toBe('done');
  });

  it('emits a terminal error when the LLM throws mid-stream', async () => {
    const llm: Llm = async function* () {
      yield { kind: 'text', text: 'so far' } as LlmDelta;
      throw new Error('provider exploded');
    };
    const events = await collect({ llm });

    const last = events.at(-1)!;
    expect(last).toEqual({ type: 'error', message: 'provider exploded' });
    expect(terminals(events)).toHaveLength(1);
  });

  it('forwards structured tool payloads to the event but never into LLM messages', async () => {
    const { llm, calls } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'finish', reason: 'stop' }],
    );
    const structured = { title: 'CC Gravy', url: '/decks/abc', deck: { cards: 60 } };
    const executeTool = vi.fn().mockResolvedValue({ ok: true, content: 'Deck: CC Gravy (60 cards)', structured });
    const events = await collect({ llm, executeTool });

    const result = events.find((e) => e.type === 'tool_result') as any;
    expect(result.structured).toEqual(structured);
    // The LLM's tool message contains ONLY the text — the token-bypass contract
    const toolMsg = calls[1].find((m) => m.role === 'tool') as any;
    expect(toolMsg.content).toBe('Deck: CC Gravy (60 cards)');
    expect(JSON.stringify(calls[1])).not.toContain('"/decks/abc"');
  });

  it('goes quiet after abort — no events emitted post-abort', async () => {
    const ac = new AbortController();
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'text', text: 'never' }, { kind: 'finish', reason: 'stop' }],
    );
    const executeTool = vi.fn(async () => {
      ac.abort();
      return { ok: true, content: 'ok' };
    });
    const events = await collect({ llm, executeTool, signal: ac.signal });

    // tool_start happened, but nothing after the abort — not even a terminal event
    expect(events.map((e) => e.type)).toEqual(['tool_start']);
  });
});

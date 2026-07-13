/**
 * Unit tests for the hosted-chat agent loop — pure orchestration over an
 * injected LLM generator and tool executor. No HTTP, no Next, no DB.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AgentEvent, ChatMessage, ConfirmationGate, Llm, LlmDelta, OpenAiTool, ToolCall } from './types';
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
  confirmation?: ConfirmationGate;
}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  await runAgentLoop({
    messages: opts.messages ?? [{ role: 'user', content: 'hi' }],
    tools: TOOLS,
    llm: opts.llm,
    executeTool: opts.executeTool ?? (async () => ({ ok: true, content: 'ok' })),
    maxIterations: opts.maxIterations,
    signal: opts.signal,
    confirmation: opts.confirmation,
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

  it('accumulates usage across iterations — done carries the turn total, not the last LLM call', async () => {
    const { llm } = scriptedLlm(
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
        { kind: 'usage', usage: { prompt_tokens: 500, completion_tokens: 60 } },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [
        { kind: 'text', text: 'You have 9 binders.' },
        { kind: 'usage', usage: { prompt_tokens: 700, completion_tokens: 40 } },
        { kind: 'finish', reason: 'stop' },
      ],
    );
    const events = await collect({ llm });

    const done = events.at(-1) as Extract<AgentEvent, { type: 'done' }>;
    expect(done.usage).toEqual({ prompt_tokens: 1200, completion_tokens: 100 });
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
    // Provenance-fenced: tool output is wrapped so the system prompt's
    // never-follow-instructions-in-tool-output rule has an anchor.
    expect(toolMsg).toMatchObject({ tool_call_id: 'c1', content: '<tool_output>\nBINDER LIST\n</tool_output>' });
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

  it('makes a final tool-less answer pass when the iteration cap is hit', async () => {
    // 3 iterations of tool requests exhaust the cap; the loop must then ask
    // the LLM ONCE more — with no tools offered and an explicit answer-now
    // instruction — so the user gets an answer built from the gathered data
    // instead of a dead-end error.
    const toolTurn: LlmDelta[] = [
      { kind: 'tool_calls', toolCalls: [call('x', 'list_binders')] },
      { kind: 'finish', reason: 'tool_calls' },
    ];
    const finalTurn: LlmDelta[] = [
      { kind: 'text', text: 'Here is what I found so far.' },
      { kind: 'usage', usage: { prompt_tokens: 100, completion_tokens: 10 } },
      { kind: 'finish', reason: 'stop' },
    ];
    const toolsSeen: (OpenAiTool[] | undefined)[] = [];
    const base = scriptedLlm(toolTurn, toolTurn, toolTurn, finalTurn);
    const llm: Llm = async function* (opts) {
      toolsSeen.push(opts.tools);
      yield* base.llm(opts);
    };
    const events = await collect({ llm, maxIterations: 3 });

    // The final pass offered NO tools and appended an answer-now instruction.
    expect(base.calls).toHaveLength(4);
    expect(toolsSeen[3]).toEqual([]);
    const lastMsg = base.calls[3].at(-1)!;
    expect(lastMsg.role).toBe('system');
    expect(String(lastMsg.content)).toMatch(/answer now/i);

    // Its text streamed to the user, and the turn ended in done (capped).
    const text = events.filter((e) => e.type === 'token').map((e: any) => e.text).join('');
    expect(text).toContain('Here is what I found so far.');
    const done = events.at(-1) as any;
    expect(done.type).toBe('done');
    expect(done.capped).toBe(true);
    expect(terminals(events)).toHaveLength(1);
  });

  it('falls back to the cap error when the final answer pass itself throws', async () => {
    const toolTurn: LlmDelta[] = [
      { kind: 'tool_calls', toolCalls: [call('x', 'list_binders')] },
      { kind: 'finish', reason: 'tool_calls' },
    ];
    const base = scriptedLlm(toolTurn, toolTurn, toolTurn); // 4th call → throws 'scripted llm exhausted'
    const events = await collect({ llm: base.llm, maxIterations: 3 });

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
    expect(toolMsg.content).toContain('Deck: CC Gravy (60 cards)');
    expect(JSON.stringify(calls[1])).not.toContain('"/decks/abc"');
  });

  describe('destructive-tool confirmation', () => {
    /** One remove_from_wants tool round, then a closing text turn. */
    const removeTurns = (): LlmDelta[][] => [
      [
        { kind: 'tool_calls', toolCalls: [call('c1', 'remove_from_wants', '{"printing_id":"p1","quantity":1}')] },
        { kind: 'finish', reason: 'tool_calls' },
      ],
      [{ kind: 'text', text: 'done' }, { kind: 'finish', reason: 'stop' }],
    ];

    const gate = (wait: ConfirmationGate['wait']): ConfirmationGate => ({
      required: (name) => name === 'remove_from_wants',
      wait,
    });

    it('emits confirmation_request before executing and runs the tool after confirm', async () => {
      const { llm } = scriptedLlm(...removeTurns());
      const executeTool = vi.fn().mockResolvedValue({ ok: true, content: 'removed' });
      const wait = vi.fn().mockResolvedValue('confirm');
      const events = await collect({ llm, executeTool, confirmation: gate(wait) });

      expect(events.map((e) => e.type)).toEqual([
        'confirmation_request', 'tool_start', 'tool_result', 'token', 'done',
      ]);
      expect(events[0]).toEqual({
        type: 'confirmation_request',
        id: 'c1',
        name: 'remove_from_wants',
        args: { printing_id: 'p1', quantity: 1 },
      });
      // The gate saw the parsed call and executed only after it resolved
      expect(wait).toHaveBeenCalledWith(expect.objectContaining({
        id: 'c1', name: 'remove_from_wants', args: { printing_id: 'p1', quantity: 1 },
      }));
      expect(executeTool).toHaveBeenCalledTimes(1);
    });

    it('deny: never executes, surfaces a declined tool_result, and the LLM sees an Error tool message', async () => {
      const { llm, calls } = scriptedLlm(...removeTurns());
      const executeTool = vi.fn();
      const events = await collect({
        llm, executeTool, confirmation: gate(async () => 'deny'),
      });

      expect(executeTool).not.toHaveBeenCalled();
      expect(events.map((e) => e.type)).toEqual([
        'confirmation_request', 'tool_result', 'token', 'done',
      ]);
      const result = events[1] as Extract<AgentEvent, { type: 'tool_result' }>;
      expect(result).toMatchObject({ id: 'c1', name: 'remove_from_wants', ok: false });
      expect(result.content).toMatch(/declined/i);
      // The model gets an Error-prefixed tool message so it can adapt
      const toolMsg = calls[1].find((m) => m.role === 'tool') as any;
      expect(toolMsg.content).toMatch(/^Error: /);
      expect(toolMsg.content).toMatch(/declined/i);
      expect(terminals(events)).toEqual([{ type: 'done', usage: undefined, iterations: 2 }]);
    });

    it('does not gate tools the predicate rejects', async () => {
      const { llm } = scriptedLlm(
        [
          { kind: 'tool_calls', toolCalls: [call('c1', 'list_binders')] },
          { kind: 'finish', reason: 'tool_calls' },
        ],
        [{ kind: 'finish', reason: 'stop' }],
      );
      const wait = vi.fn();
      const events = await collect({ llm, confirmation: gate(wait) });

      expect(wait).not.toHaveBeenCalled();
      expect(events.map((e) => e.type)).toEqual(['tool_start', 'tool_result', 'done']);
    });

    it('goes silent when aborted while waiting for a decision', async () => {
      const ac = new AbortController();
      const { llm } = scriptedLlm(...removeTurns());
      const executeTool = vi.fn();
      const wait = vi.fn(async () => {
        ac.abort();
        return 'deny' as const;
      });
      const events = await collect({ llm, executeTool, confirmation: gate(wait), signal: ac.signal });

      expect(executeTool).not.toHaveBeenCalled();
      expect(events.map((e) => e.type)).toEqual(['confirmation_request']);
    });

    it('treats a thrown wait as a declined call, not a crash', async () => {
      const { llm } = scriptedLlm(...removeTurns());
      const executeTool = vi.fn();
      const events = await collect({
        llm, executeTool, confirmation: gate(async () => { throw new Error('registry down'); }),
      });

      expect(executeTool).not.toHaveBeenCalled();
      const result = events.find((e) => e.type === 'tool_result') as any;
      expect(result.ok).toBe(false);
      expect(result.content).toContain('registry down');
      expect(terminals(events)).toHaveLength(1);
      expect(terminals(events)[0].type).toBe('done');
    });

    it('skips confirmation for invalid JSON args — nothing to confirm, nothing executes', async () => {
      const { llm } = scriptedLlm(
        [
          { kind: 'tool_calls', toolCalls: [call('c1', 'remove_from_wants', '{oops')] },
          { kind: 'finish', reason: 'tool_calls' },
        ],
        [{ kind: 'finish', reason: 'stop' }],
      );
      const wait = vi.fn();
      const events = await collect({ llm, confirmation: gate(wait) });

      expect(wait).not.toHaveBeenCalled();
      expect(events.map((e) => e.type)).toEqual(['tool_start', 'tool_result', 'done']);
      expect((events[1] as any).ok).toBe(false);
    });
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

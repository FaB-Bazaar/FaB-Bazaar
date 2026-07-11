/**
 * Unit tests for the OpenRouter transport: the pure SSE parser against canned
 * fixtures, and the deterministic mock mode used when no API key is set.
 */

import { describe, it, expect } from 'vitest';
import type { Llm, LlmDelta, OpenAiTool } from './types';
import { parseSseStream, createMockLlm, withFallback } from './openrouter';

async function* chunks(...parts: string[]): AsyncGenerator<string> {
  for (const part of parts) yield part;
}

async function drain(gen: AsyncGenerator<LlmDelta>): Promise<LlmDelta[]> {
  const out: LlmDelta[] = [];
  for await (const d of gen) out.push(d);
  return out;
}

const data = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

const TOOLS: OpenAiTool[] = [
  { type: 'function', function: { name: 'list_binders', description: 'd', parameters: {} } },
  { type: 'function', function: { name: 'search_printings', description: 'd', parameters: {} } },
];

describe('parseSseStream', () => {
  it('parses a text-only stream ending with [DONE]', async () => {
    const deltas = await drain(parseSseStream(chunks(
      data({ choices: [{ delta: { content: 'Hel' } }] }),
      data({ choices: [{ delta: { content: 'lo' } }] }),
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      'data: [DONE]\n\n',
    )));

    expect(deltas).toEqual([
      { kind: 'text', text: 'Hel' },
      { kind: 'text', text: 'lo' },
      { kind: 'finish', reason: 'stop' },
    ]);
  });

  it('reassembles tool-call arguments split across three fragments', async () => {
    const deltas = await drain(parseSseStream(chunks(
      data({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'list_binders', arguments: '' } }] } }] }),
      data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"includeSt' } }] } }] }),
      data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ats":true}' } }] } }] }),
      data({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
      'data: [DONE]\n\n',
    )));

    expect(deltas).toEqual([
      {
        kind: 'tool_calls',
        toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'list_binders', arguments: '{"includeStats":true}' } }],
      },
      { kind: 'finish', reason: 'tool_calls' },
    ]);
  });

  it('handles frames split across arbitrary chunk boundaries', async () => {
    const whole = data({ choices: [{ delta: { content: 'split' } }] });
    const deltas = await drain(parseSseStream(chunks(whole.slice(0, 11), whole.slice(11), 'data: [DONE]\n\n')));
    expect(deltas).toEqual([{ kind: 'text', text: 'split' }]);
  });

  it('ignores SSE comment lines (OpenRouter keep-alives)', async () => {
    const deltas = await drain(parseSseStream(chunks(
      ': OPENROUTER PROCESSING\n\n',
      data({ choices: [{ delta: { content: 'hi' } }] }),
      'data: [DONE]\n\n',
    )));
    expect(deltas).toEqual([{ kind: 'text', text: 'hi' }]);
  });

  it('surfaces the usage object', async () => {
    const deltas = await drain(parseSseStream(chunks(
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      data({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } }),
      'data: [DONE]\n\n',
    )));
    expect(deltas).toContainEqual({ kind: 'usage', usage: { prompt_tokens: 100, completion_tokens: 20 } });
  });

  it('throws on a mid-stream error payload', async () => {
    await expect(drain(parseSseStream(chunks(
      data({ error: { message: 'Insufficient credits', code: 402 } }),
    )))).rejects.toThrow(/insufficient credits/i);
  });
});

describe('createMockLlm', () => {
  const mock = createMockLlm({ sleepMs: 0 });

  it('answers "search for X" with a scripted search_printings call carrying the query', async () => {
    const deltas = await drain(mock({
      messages: [{ role: 'user', content: 'search for pummel red' }],
      tools: TOOLS,
    }));

    const toolCallDelta = deltas.find((d) => d.kind === 'tool_calls') as any;
    expect(toolCallDelta.toolCalls[0].function.name).toBe('search_printings');
    expect(JSON.parse(toolCallDelta.toolCalls[0].function.arguments)).toEqual({ cards: [{ query: 'pummel red' }] });
  });

  it('answers a remove request with a scripted remove_from_wants call (drives the confirmation flow keylessly)', async () => {
    const toolsWithRemove: OpenAiTool[] = [
      ...TOOLS,
      { type: 'function', function: { name: 'remove_from_wants', description: 'd', parameters: {} } },
    ];
    const deltas = await drain(mock({
      messages: [{ role: 'user', content: 'remove pummel from my wants' }],
      tools: toolsWithRemove,
    }));

    const toolCallDelta = deltas.find((d) => d.kind === 'tool_calls') as any;
    expect(toolCallDelta.toolCalls[0].function.name).toBe('remove_from_wants');
    expect(() => JSON.parse(toolCallDelta.toolCalls[0].function.arguments)).not.toThrow();
    expect(deltas.at(-1)).toEqual({ kind: 'finish', reason: 'tool_calls' });
  });

  it('answers a binder question with a scripted list_binders tool call', async () => {
    const deltas = await drain(mock({
      messages: [{ role: 'user', content: 'show my binders please' }],
      tools: TOOLS,
    }));

    const toolCallDelta = deltas.find((d) => d.kind === 'tool_calls') as any;
    expect(toolCallDelta.toolCalls[0].function.name).toBe('list_binders');
    expect(deltas.at(-1)).toEqual({ kind: 'finish', reason: 'tool_calls' });
  });

  it('summarizes after a tool result', async () => {
    const deltas = await drain(mock({
      messages: [
        { role: 'user', content: 'show my binders' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'mock-call-1', type: 'function', function: { name: 'list_binders', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'mock-call-1', content: 'Your Binders (9 total)…' },
      ],
      tools: TOOLS,
    }));

    const text = deltas.filter((d) => d.kind === 'text').map((d: any) => d.text).join('');
    expect(text).toContain('mock summary');
    expect(text).toContain('Your Binders');
    expect(deltas.at(-1)).toEqual(expect.objectContaining({ kind: 'finish', reason: 'stop' }));
  });

  it('is deterministic for identical input', async () => {
    const req = { messages: [{ role: 'user' as const, content: 'hello there' }], tools: TOOLS };
    expect(await drain(mock(req))).toEqual(await drain(mock(req)));
  });

  it('falls back to help text when nothing matches', async () => {
    const deltas = await drain(mock({ messages: [{ role: 'user', content: 'hello there' }], tools: TOOLS }));
    const text = deltas.filter((d) => d.kind === 'text').map((d: any) => d.text).join('');
    expect(text).toMatch(/mock mode/i);
  });
});

const REQ = { messages: [{ role: 'user' as const, content: 'hi' }], tools: TOOLS };

// Llm stub that throws immediately (before yielding) — the observed shape of
// a free-tier 429 on the first chunk.
function throwingLlm(message: string): Llm {
  return async function* () {
    throw new Error(message);
  };
}

// Llm stub that yields once, then throws — a mid-stream failure.
function partialThenThrowingLlm(text: string, message: string): Llm {
  return async function* () {
    yield { kind: 'text', text } as LlmDelta;
    throw new Error(message);
  };
}

function textLlm(text: string): Llm {
  return async function* () {
    yield { kind: 'text', text } as LlmDelta;
    yield { kind: 'finish', reason: 'stop' } as LlmDelta;
  };
}

describe('withFallback', () => {
  it('retries on the fallback when the primary 429s before any delta', async () => {
    const primary = throwingLlm('OpenRouter request failed (HTTP 429): rate limited');
    const fallback = textLlm('fallback answer');
    const { llm, usedFallback } = withFallback({ primary, fallback });

    const deltas = await drain(llm(REQ));

    expect(deltas).toEqual([
      { kind: 'text', text: 'fallback answer' },
      { kind: 'finish', reason: 'stop' },
    ]);
    expect(usedFallback()).toBe(true);
  });

  it('stays on the fallback for subsequent calls once triggered', async () => {
    let primaryCalls = 0;
    const primary: Llm = async function* () {
      primaryCalls++;
      throw new Error('HTTP 429');
    };
    const fallback = textLlm('ok');
    const { llm } = withFallback({ primary, fallback });

    await drain(llm(REQ));
    await drain(llm(REQ));

    expect(primaryCalls).toBe(1); // second call went straight to fallback
  });

  it('does not retry a non-rate-limit error — propagates as-is', async () => {
    const primary = throwingLlm('OpenRouter request failed (HTTP 402): insufficient credits');
    const fallback = textLlm('should not be used');
    const { llm, usedFallback } = withFallback({ primary, fallback });

    await expect(drain(llm(REQ))).rejects.toThrow(/402/);
    expect(usedFallback()).toBe(false);
  });

  it('does not retry once content has already streamed — propagates the mid-stream error', async () => {
    const primary = partialThenThrowingLlm('partial', 'HTTP 429');
    const fallback = textLlm('should not be used');
    const { llm, usedFallback } = withFallback({ primary, fallback });

    const gen = llm(REQ);
    await expect(drain(gen)).rejects.toThrow(/429/);
    expect(usedFallback()).toBe(false);
  });

  it('passes through cleanly when the primary succeeds', async () => {
    const primary = textLlm('primary answer');
    const fallback = throwingLlm('should not be called');
    const { llm, usedFallback } = withFallback({ primary, fallback });

    const deltas = await drain(llm(REQ));

    expect(deltas).toEqual([
      { kind: 'text', text: 'primary answer' },
      { kind: 'finish', reason: 'stop' },
    ]);
    expect(usedFallback()).toBe(false);
  });
});

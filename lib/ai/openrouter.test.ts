/**
 * Unit tests for the OpenRouter transport: the pure SSE parser against canned
 * fixtures, and the deterministic mock mode used when no API key is set.
 */

import { describe, it, expect } from 'vitest';
import type { LlmDelta, OpenAiTool } from './types';
import { parseSseStream, createMockLlm } from './openrouter';

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

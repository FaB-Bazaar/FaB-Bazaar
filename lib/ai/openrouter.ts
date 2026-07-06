// LLM transport for the hosted Volzar chat: OpenRouter (OpenAI-compatible)
// over plain fetch — no SDK dependency. Exposes:
//   createLlm({model})  — picks the real transport or the keyless mock
//   parseSseStream      — pure SSE→LlmDelta parser (fixture-tested)
//   createMockLlm       — deterministic scripted LLM for keyless dev/tests
//
// Tool-call fragments are accumulated HERE; the agent loop only ever sees
// complete tool calls (see lib/ai/types.ts `Llm`).

import type { ChatMessage, Llm, LlmDelta, OpenAiTool, ToolCall } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function createLlm(opts: { model: string }): Llm {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || opts.model === 'mock') {
    return createMockLlm({});
  }
  return createOpenRouterLlm({ model: opts.model, apiKey });
}

// ---------------------------------------------------------------------------
// Real transport
// ---------------------------------------------------------------------------

function createOpenRouterLlm(opts: { model: string; apiKey: string }): Llm {
  return async function* ({ messages, tools, signal }) {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter attribution etiquette — shows in their dashboard.
        'HTTP-Referer': 'https://fabbazaar.app',
        'X-Title': 'FaB Bazaar - Volzar',
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        tools,
        tool_choice: 'auto',
        stream: true,
        usage: { include: true },
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenRouter request failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    yield* parseSseStream(decodeStream(response.body));
  };
}

async function* decodeStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Pure parser: OpenAI-format SSE text chunks → LlmDelta stream.
 * - ignores `:` comment lines (OpenRouter keep-alives)
 * - accumulates tool-call fragments by index; emits complete calls once,
 *   just before the finish delta
 * - throws on mid-stream `{error: …}` payloads
 */
export async function* parseSseStream(chunks: AsyncIterable<string>): AsyncGenerator<LlmDelta> {
  let buffer = '';
  const pendingToolCalls = new Map<number, ToolCall>();
  let finishReason: 'stop' | 'tool_calls' | 'length' | null = null;
  let usageDelta: LlmDelta | null = null;

  const flushTerminal = function* (): Generator<LlmDelta> {
    if (pendingToolCalls.size > 0) {
      const toolCalls = [...pendingToolCalls.entries()].sort(([a], [b]) => a - b).map(([, c]) => c);
      pendingToolCalls.clear();
      yield { kind: 'tool_calls', toolCalls };
    }
    if (usageDelta) {
      yield usageDelta;
      usageDelta = null;
    }
    if (finishReason) {
      yield { kind: 'finish', reason: finishReason };
      finishReason = null;
    }
  };

  for await (const chunk of chunks) {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trimEnd();
      buffer = buffer.slice(newlineIndex + 1);

      if (line === '' || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;

      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        yield* flushTerminal();
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue; // tolerate malformed keep-alive noise
      }

      if (parsed.error) {
        throw new Error(parsed.error.message || 'OpenRouter stream error');
      }

      if (parsed.usage) {
        usageDelta = {
          kind: 'usage',
          usage: {
            prompt_tokens: parsed.usage.prompt_tokens ?? 0,
            completion_tokens: parsed.usage.completion_tokens ?? 0,
          },
        };
      }

      const choice = parsed.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        yield { kind: 'text', text: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const fragment of delta.tool_calls) {
          const index = fragment.index ?? 0;
          const existing = pendingToolCalls.get(index);
          if (!existing) {
            pendingToolCalls.set(index, {
              id: fragment.id || `call_${index}`,
              type: 'function',
              function: {
                name: fragment.function?.name || '',
                arguments: fragment.function?.arguments || '',
              },
            });
          } else {
            if (fragment.id) existing.id = fragment.id;
            if (fragment.function?.name) existing.function.name = fragment.function.name;
            if (fragment.function?.arguments) existing.function.arguments += fragment.function.arguments;
          }
        }
      }
      if (choice.finish_reason) {
        finishReason = choice.finish_reason === 'tool_calls'
          ? 'tool_calls'
          : choice.finish_reason === 'length'
            ? 'length'
            : 'stop';
      }
    }
  }

  // Stream ended without [DONE] — flush whatever we have.
  yield* flushTerminal();
}

// ---------------------------------------------------------------------------
// Mock mode — deterministic, keyless. Scripted to exercise the full loop:
// a binder question triggers one list_binders round, then a summary.
// ---------------------------------------------------------------------------

export function createMockLlm(opts: { sleepMs?: number }): Llm {
  const sleepMs = opts.sleepMs ?? 20;
  const sleep = () => (sleepMs > 0 ? new Promise((r) => setTimeout(r, sleepMs)) : Promise.resolve());

  async function* streamText(text: string): AsyncGenerator<LlmDelta> {
    for (const word of text.split(/(?<=\s)/)) {
      await sleep();
      yield { kind: 'text', text: word };
    }
  }

  return async function* ({ messages, tools }) {
    const last = messages.at(-1);
    // Note: not Extract<ChatMessage, { role: 'user' }> — that resolves to
    // never because the union member's role is 'system' | 'user'.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user') as
      | { role: 'system' | 'user'; content: string }
      | undefined;

    // 1. Just got a tool result back → summarize it.
    if (last?.role === 'tool') {
      const toolName = findToolName(messages, last.tool_call_id) ?? 'the tool';
      yield* streamText(
        `Here's what I found (mock summary of ${toolName}):\n${last.content.slice(0, 300)}`,
      );
      yield { kind: 'usage', usage: { prompt_tokens: 500, completion_tokens: 60 } };
      yield { kind: 'finish', reason: 'stop' };
      return;
    }

    // 2. "search …" and search_printings is available → scripted search call
    //    (lets Bridge A — the /opt deep-link card — demo keyless).
    const hasSearch = tools.some((t) => t.function.name === 'search_printings');
    const searchMatch = lastUser?.content.match(/search (?:for )?(.+)/i);
    if (searchMatch && hasSearch) {
      const query = searchMatch[1].trim();
      yield* streamText(`Searching for "${query}". `);
      yield {
        kind: 'tool_calls',
        toolCalls: [{
          id: 'mock-search-1',
          type: 'function',
          function: { name: 'search_printings', arguments: JSON.stringify({ cards: [{ query }] }) },
        }],
      };
      yield { kind: 'finish', reason: 'tool_calls' };
      return;
    }

    // 3. "remove …" → scripted remove_from_wants call. Checked before the
    //    binder rule ("remove X from my binder" contains "binder") so remove
    //    requests always demo the destructive-confirmation pause.
    const hasRemoveWants = tools.some((t) => t.function.name === 'remove_from_wants');
    if (lastUser && /\bremove\b/i.test(lastUser.content) && hasRemoveWants) {
      yield* streamText('I can remove that from your wants. ');
      yield {
        kind: 'tool_calls',
        toolCalls: [{
          id: 'mock-remove-1',
          type: 'function',
          function: { name: 'remove_from_wants', arguments: JSON.stringify({ printing_id: 'mock-printing-1', quantity: 1 }) },
        }],
      };
      yield { kind: 'finish', reason: 'tool_calls' };
      return;
    }

    // 4. Binder question and list_binders is available → scripted tool call.
    const hasListBinders = tools.some((t) => t.function.name === 'list_binders');
    if (lastUser && /binder/i.test(lastUser.content) && hasListBinders) {
      yield* streamText('Let me check your binders. ');
      yield {
        kind: 'tool_calls',
        toolCalls: [{ id: 'mock-call-1', type: 'function', function: { name: 'list_binders', arguments: '{}' } }],
      };
      yield { kind: 'finish', reason: 'tool_calls' };
      return;
    }

    // 5. Fallback help text.
    yield* streamText(
      'Mock mode — no OPENROUTER_API_KEY is configured, so I follow a fixed script. ' +
        'Try asking about your binders, or "search for pummel red", to see a full tool round-trip.',
    );
    yield { kind: 'usage', usage: { prompt_tokens: 200, completion_tokens: 40 } };
    yield { kind: 'finish', reason: 'stop' };
  };
}

function findToolName(messages: ChatMessage[], toolCallId: string): string | null {
  for (const message of messages) {
    if (message.role === 'assistant' && message.tool_calls) {
      const match = message.tool_calls.find((c) => c.id === toolCallId);
      if (match) return match.function.name;
    }
  }
  return null;
}

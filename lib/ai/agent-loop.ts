// The hosted-chat agent loop: pure orchestration between an LLM transport and
// a tool executor. No HTTP, no Next.js, no DB — everything effectful is
// injected, which is what keeps this unit-testable.
//
// Event invariant: exactly one terminal event (`done` | `error`) per run, and
// nothing is emitted after it. Abort is the one exception: an aborted run goes
// silent immediately (the client is gone; nobody is listening).

import type {
  AgentEvent,
  ChatMessage,
  ExecuteTool,
  Llm,
  OpenAiTool,
  ToolCall,
  Usage,
} from './types';

const DEFAULT_MAX_ITERATIONS = 8;

export async function runAgentLoop(opts: {
  messages: ChatMessage[];
  tools: OpenAiTool[];
  llm: Llm;
  executeTool: ExecuteTool;
  maxIterations?: number;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}): Promise<void> {
  const { tools, llm, executeTool, signal, onEvent } = opts;
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: ChatMessage[] = [...opts.messages];
  let usage: Usage | undefined;

  const aborted = () => signal?.aborted === true;

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (aborted()) return;

      let bufferedText = '';
      let toolCalls: ToolCall[] | null = null;
      let finishReason: 'stop' | 'tool_calls' | 'length' = 'stop';

      for await (const delta of llm({ messages, tools, signal })) {
        if (aborted()) return;
        switch (delta.kind) {
          case 'text':
            bufferedText += delta.text;
            onEvent({ type: 'token', text: delta.text });
            break;
          case 'tool_calls':
            toolCalls = delta.toolCalls;
            break;
          case 'usage':
            usage = delta.usage;
            break;
          case 'finish':
            finishReason = delta.reason;
            break;
        }
      }

      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: bufferedText || null, tool_calls: toolCalls });

        for (const toolCall of toolCalls) {
          if (aborted()) return;
          const { id, function: fn } = toolCall;

          let args: unknown;
          let parseError: string | null = null;
          if (fn.arguments === '') {
            args = {};
          } else {
            try {
              args = JSON.parse(fn.arguments);
            } catch {
              parseError = `Invalid JSON arguments for ${fn.name}: ${fn.arguments.slice(0, 200)}`;
            }
          }

          onEvent({ type: 'tool_start', id, name: fn.name, args: parseError ? fn.arguments : args });

          const startedAt = performance.now();
          let ok: boolean;
          let content: string;
          let structured: unknown;
          if (parseError) {
            ok = false;
            content = parseError;
          } else {
            try {
              const result = await executeTool({ name: fn.name, args, signal });
              ok = result.ok;
              content = result.content;
              structured = result.structured;
            } catch (error) {
              ok = false;
              content = error instanceof Error ? error.message : String(error);
            }
          }
          if (aborted()) return;

          const ms = Math.round(performance.now() - startedAt);
          // structured rides the event to the UI only — the tool message the
          // LLM sees (below) is text-only. That's the point.
          onEvent({ type: 'tool_result', id, name: fn.name, ok, content, ms, structured });
          messages.push({
            role: 'tool',
            tool_call_id: id,
            content: ok ? content : `Error: ${content}`,
          });
        }
        continue; // next iteration: let the LLM see the tool results
      }

      // No tool calls — this is the final assistant turn.
      if (bufferedText) {
        messages.push({ role: 'assistant', content: bufferedText });
      }
      if (finishReason === 'length') {
        onEvent({ type: 'token', text: '\n\n[response truncated]' });
      }
      onEvent({ type: 'done', usage, iterations: iteration });
      return;
    }

    if (aborted()) return;
    onEvent({
      type: 'error',
      message: `Reached the tool-call limit (${maxIterations}) for one message. Try a more specific request.`,
    });
  } catch (error) {
    if (aborted()) return;
    onEvent({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

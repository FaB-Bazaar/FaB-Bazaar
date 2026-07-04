// Shared types for the hosted Fabby chat agent loop.
//
// lib/ai is layered: openrouter.ts (LLM transport) and mcp-bridge.ts (tool
// execution against our own MCP endpoint) both depend only on this file;
// agent-loop.ts consumes both through the `Llm` / executeTool contracts.
// The route and UI import these types type-only.

/** OpenAI-compatible tool call (function.arguments is a JSON string). */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** OpenAI-compatible chat message — the wire format OpenRouter consumes. */
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** OpenAI tool definition; `parameters` carries the MCP inputSchema verbatim. */
export interface OpenAiTool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

/**
 * What the LLM transport yields. Tool-call fragment accumulation happens
 * inside the transport — the loop only ever sees complete tool calls.
 */
export type LlmDelta =
  | { kind: 'text'; text: string }
  | { kind: 'tool_calls'; toolCalls: ToolCall[] }
  | { kind: 'usage'; usage: Usage }
  | { kind: 'finish'; reason: 'stop' | 'tool_calls' | 'length' };

export type Llm = (req: {
  messages: ChatMessage[];
  tools: OpenAiTool[];
  signal?: AbortSignal;
}) => AsyncGenerator<LlmDelta>;

/**
 * Events the agent loop emits (and the SSE wire format, one JSON per frame).
 * Invariant: exactly one terminal event per run — `done` or `error`, never
 * both, and nothing after it.
 */
export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_start'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; content: string; ms: number }
  | { type: 'done'; usage?: Usage; iterations: number }
  | { type: 'error'; message: string };

export interface ToolExecutionResult {
  ok: boolean;
  content: string;
}

export type ExecuteTool = (call: {
  name: string;
  args: unknown;
  signal?: AbortSignal;
}) => Promise<ToolExecutionResult>;

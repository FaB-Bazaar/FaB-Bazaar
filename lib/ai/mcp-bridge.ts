// The hosted chat's MCP client: talks to our OWN MCP endpoint over localhost
// (`?toolset=lite`), exactly like an external client would. This gives the
// agent loop the same tools, schemas, and behavior Claude/LM Studio see, and
// the MCP route's usage wrapper records every call in mcp_usage_daily.
//
// The User-Agent matters: the wrapper derives `client` from the first token
// (split on space/paren), so 'fabbazaar-hosted (chat)' records rows with
// client='fabbazaar-hosted'.
//
// NOTE: ?toolset=lite filters ADVERTISEMENT only — tools/call executes any
// tool. executeTool therefore allowlists names against the discovered
// tools/list and short-circuits unknown names with a corrective message.

import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import type { OpenAiTool, ToolExecutionResult } from './types';

const USER_AGENT = 'fabbazaar-hosted (chat)';

function baseUrl(): string {
  return `${getMcpApiBaseUrl()}/api/mcp/server`;
}

function liteUrl(): string {
  return `${baseUrl()}?toolset=lite`;
}

function headers(bearer: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
    'User-Agent': USER_AGENT,
  };
}

type McpTool = { name: string; description: string; inputSchema: unknown };

function toOpenAiTools(mcpTools: McpTool[]): OpenAiTool[] {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));
}

async function listTools(url: string, bearer: string): Promise<McpTool[]> {
  const response = await mcpFetch(url, {
    method: 'POST',
    headers: headers(bearer),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

  if (!response.ok) {
    throw new Error(`MCP tools/list failed (HTTP ${response.status})`);
  }

  const body = await response.json();
  return body?.result?.tools ?? [];
}

export async function fetchLiteTools(bearer: string): Promise<{
  tools: OpenAiTool[];
  validNames: Set<string>;
}> {
  const mcpTools = await listTools(liteUrl(), bearer);
  return { tools: toOpenAiTools(mcpTools), validNames: new Set(mcpTools.map((t) => t.name)) };
}

/**
 * Advertise a hand-picked subset of the FULL catalog, by name. Used to add a
 * few write tools (e.g. deck editing) to the hosted chat WITHOUT expanding the
 * shared lite advertisement that LM Studio / other local hosts also consume.
 * validNames is the intersection of requested and actually-present tools.
 */
export async function fetchToolsByName(bearer: string, names: ReadonlySet<string>): Promise<{
  tools: OpenAiTool[];
  validNames: Set<string>;
}> {
  const mcpTools = (await listTools(baseUrl(), bearer)).filter((t) => names.has(t.name));
  return { tools: toOpenAiTools(mcpTools), validNames: new Set(mcpTools.map((t) => t.name)) };
}

export async function executeTool(opts: {
  name: string;
  args: unknown;
  bearer: string;
  validNames: Set<string>;
  signal?: AbortSignal;
}): Promise<ToolExecutionResult> {
  const { name, args, bearer, validNames, signal } = opts;

  if (!validNames.has(name)) {
    return {
      ok: false,
      content: `Unknown tool '${name}'. Available tools: ${[...validNames].join(', ')}`,
    };
  }

  const response = await mcpFetch(liteUrl(), {
    method: 'POST',
    signal,
    headers: headers(bearer),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  if (!response.ok) {
    return { ok: false, content: `MCP call failed (HTTP ${response.status}) — try again.` };
  }

  const body = await response.json();

  // Three shapes: top-level JSON-RPC error, result.isError, and success.
  if (body?.error) {
    return { ok: false, content: body.error.message || 'MCP error' };
  }

  const content: string = (body?.result?.content ?? [])
    .filter((c: any) => c?.type === 'text')
    .map((c: any) => c.text)
    .join('\n');

  if (body?.result?.isError) {
    return { ok: false, content: content || 'Tool reported an error' };
  }
  // structuredContent (when a tool provides it, e.g. get_deck) is the
  // token-bypass channel: full data for the UI, while the LLM reads only
  // the text block above.
  return { ok: true, content, structured: body?.result?.structuredContent };
}

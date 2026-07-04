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

function mcpUrl(): string {
  return `${getMcpApiBaseUrl()}/api/mcp/server?toolset=lite`;
}

function headers(bearer: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
    'User-Agent': USER_AGENT,
  };
}

export async function fetchLiteTools(bearer: string): Promise<{
  tools: OpenAiTool[];
  validNames: Set<string>;
}> {
  const response = await mcpFetch(mcpUrl(), {
    method: 'POST',
    headers: headers(bearer),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

  if (!response.ok) {
    throw new Error(`MCP tools/list failed (HTTP ${response.status})`);
  }

  const body = await response.json();
  const mcpTools: Array<{ name: string; description: string; inputSchema: unknown }> =
    body?.result?.tools ?? [];

  const tools: OpenAiTool[] = mcpTools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));

  return { tools, validNames: new Set(mcpTools.map((t) => t.name)) };
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

  const response = await mcpFetch(mcpUrl(), {
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
  return { ok: true, content };
}

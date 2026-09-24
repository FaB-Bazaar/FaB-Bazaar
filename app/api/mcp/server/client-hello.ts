// What an MCP client declares in `initialize` (clientInfo + capabilities).
// Logged once per session so we can see which display features each host
// (Claude, ChatGPT, Meta Muse, …) actually supports — e.g. whether it renders
// MCP Apps UI (`ui://` widgets like the get_deck viewer) or only text.

export const MCP_APPS_UI_EXTENSION = 'io.modelcontextprotocol/ui';

/** Longest JSON kept for a capability blob — clients control this input. */
const MAX_BLOB_CHARS = 1_000;

export interface ClientHelloSummary {
  client: string | null;
  version: string | null;
  protocol: string | null;
  capabilities: string[];
  mcpAppsUi: boolean;
  extensions: unknown;
  experimental: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : null);

function capped(v: unknown): unknown {
  if (v == null) return null;
  const json = JSON.stringify(v);
  return json.length <= MAX_BLOB_CHARS ? v : `${json.slice(0, MAX_BLOB_CHARS)}…(truncated)`;
}

export function summarizeClientHello(params: unknown): ClientHelloSummary {
  const p = isObject(params) ? params : {};
  const info = isObject(p.clientInfo) ? p.clientInfo : {};
  const caps = isObject(p.capabilities) ? p.capabilities : {};
  const extensions = isObject(caps.extensions) ? caps.extensions : null;
  return {
    client: str(info.name),
    version: str(info.version),
    protocol: str(p.protocolVersion),
    capabilities: Object.keys(caps).sort().slice(0, 50),
    mcpAppsUi: !!extensions && MCP_APPS_UI_EXTENSION in extensions,
    extensions: capped(extensions),
    experimental: capped(caps.experimental ?? null),
  };
}

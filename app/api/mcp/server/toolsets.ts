// MCP toolset selection (?toolset=lite on the server URL).
//
// The full 37-tool catalog costs ~22k tokens of schema per chat — more than a
// 16k local-model context before the user types a word. Lite advertises the
// 12 collector tools (~9k tokens) for context-constrained clients (LM Studio
// and other local hosts). Clients opt in explicitly via URL; there is no
// client sniffing, so the default (full) path — what Claude uses — is
// byte-identical to before this feature existed.
//
// Lite filters tools/list ADVERTISEMENT only. tools/call still executes any
// tool: this is a context-size feature, not access control. Real authorization
// is OAuth scopes plus per-tool role checks.

export type Toolset = 'full' | 'lite';

interface AdvertisedTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

/** Collector core: view/search/maintain collection + wants, trading lookup, read-only decks. */
export const LITE_TOOLSET: ReadonlySet<string> = new Set([
  'read_mandatory_constants_first',
  'search_printings',
  'list_binders',
  'get_binder',
  'add_to_binder',
  'remove_from_binder',
  'get_wants',
  'add_to_wants',
  'remove_from_wants',
  'who_has',
  'list_decks',
  'get_deck',
]);

/** Unknown/absent values resolve to full so a typo never breaks a client. */
export function resolveToolset(requestUrl: string): Toolset {
  try {
    const value = new URL(requestUrl).searchParams.get('toolset');
    return value === 'lite' ? 'lite' : 'full';
  } catch {
    return 'full';
  }
}

/** Full returns the input array itself — the default path stays identical. */
export function filterToolsForToolset<T extends AdvertisedTool>(tools: T[], toolset: Toolset): T[] {
  if (toolset !== 'lite') return tools;
  return tools.filter(t => LITE_TOOLSET.has(t.name));
}

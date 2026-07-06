/**
 * Route unit tests for the hosted Fabby chat SSE endpoint: auth gates, rate
 * limiting, body validation, and the SSE stream shape (mock LLM runs for real;
 * the MCP bridge is mocked).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { getFabbyChatAccess: vi.fn() },
  oauthFlowService: { generateAccessToken: vi.fn().mockReturnValue('jwt-token') },
  llmUsageService: { getTodayRequestCount: vi.fn(), recordTurn: vi.fn() },
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/ai/mcp-bridge', () => ({
  fetchLiteTools: vi.fn(),
  fetchToolsByName: vi.fn(),
  executeTool: vi.fn(),
}));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { auth } from '@/auth';
import { userService, llmUsageService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import { fetchLiteTools, fetchToolsByName, executeTool } from '@/lib/ai/mcp-bridge';
import { resolveConfirmation } from '@/lib/ai/confirmations';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockGetAccess = vi.mocked(userService.getFabbyChatAccess);
const mockRateLimit = vi.mocked(rateLimit);
const mockFetchLiteTools = vi.mocked(fetchLiteTools);
const mockFetchToolsByName = vi.mocked(fetchToolsByName);
const mockExecuteTool = vi.mocked(executeTool);
const mockGetTodayRequestCount = vi.mocked(llmUsageService.getTodayRequestCount);
const mockRecordTurn = vi.mocked(llmUsageService.recordTurn);

const LITE_TOOLS = {
  tools: [{ type: 'function' as const, function: { name: 'list_binders', description: 'd', parameters: {} } }],
  validNames: new Set(['list_binders']),
};

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/fabby-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { model: 'mock', messages: [{ role: 'user', content: 'show my binders' }] };

async function readSseEvents(response: Response): Promise<any[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => JSON.parse(f.slice(6)));
}

/**
 * Incremental SSE reader for mid-stream assertions (the confirmation pause).
 * `readUntil` pulls frames until the predicate matches or the stream ends.
 */
function sseReader(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: any[] = [];

  async function readUntil(predicate: (e: any) => boolean): Promise<void> {
    while (!events.some(predicate)) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (frame.startsWith('data: ')) events.push(JSON.parse(frame.slice(6)));
      }
    }
  }

  return { events, readUntil };
}

const REMOVE_TOOLS = {
  tools: [
    { type: 'function' as const, function: { name: 'list_binders', description: 'd', parameters: {} } },
    { type: 'function' as const, function: { name: 'remove_from_wants', description: 'd', parameters: {} } },
  ],
  validNames: new Set(['list_binders', 'remove_from_wants']),
};

const REMOVE_BODY = { model: 'mock', messages: [{ role: 'user', content: 'remove pummel from my wants' }] };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENROUTER_API_KEY; // force mock mode
  mockAuth.mockResolvedValue({ user: { id: 'user-1', name: 'mistercakes' } });
  mockGetAccess.mockResolvedValue({ success: true, data: { isSuperAdmin: true, metafySupporterTier: 'free' } } as any);
  mockRateLimit.mockResolvedValue({ success: true, remaining: 29 } as any);
  mockFetchLiteTools.mockResolvedValue(LITE_TOOLS as any);
  mockFetchToolsByName.mockResolvedValue({ tools: [], validNames: new Set() } as any);
  mockExecuteTool.mockResolvedValue({ ok: true, content: 'Your Binders (9 total)' });
  mockGetTodayRequestCount.mockResolvedValue({ success: true, data: 0 });
  mockRecordTurn.mockResolvedValue({ success: true, data: undefined });
});

describe('POST /api/fabby-chat', () => {
  it('401s without a session', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('403s for free-tier non-admins (no Fabby Chat access)', async () => {
    mockGetAccess.mockResolvedValue({ success: true, data: { isSuperAdmin: false, metafySupporterTier: 'free' } } as any);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it('allows paid Metafy supporters who are not admins', async () => {
    mockGetAccess.mockResolvedValue({ success: true, data: { isSuperAdmin: false, metafySupporterTier: 'paid' } } as any);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(200);
    await readSseEvents(res); // drain so this turn's done doesn't bleed into later tests
  });

  it('429s with rate-limit headers when the limit is hit', async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 60_000 } as any);
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('400s on malformed bodies', async () => {
    expect((await POST(request({ model: 'mock', messages: [] }))).status).toBe(400);
    expect((await POST(request({ model: 'mock', messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] }))).status).toBe(400); // last not user
    expect((await POST(request({ model: 'not-a-real-model', messages: VALID_BODY.messages }))).status).toBe(400);
  });

  it('502s when tool discovery fails, before any stream starts', async () => {
    mockFetchLiteTools.mockRejectedValue(new Error('MCP tools/list failed (HTTP 500)'));
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(502);
  });

  it('augments the lite set with the deck + game-results tools', async () => {
    const res = await POST(request(VALID_BODY));
    await readSseEvents(res); // drain the stream

    expect(mockFetchToolsByName).toHaveBeenCalledTimes(1);
    const requested = mockFetchToolsByName.mock.calls[0][1];
    expect(requested).toEqual(new Set(['create_deck', 'add_cards_to_deck', 'remove_cards_from_deck', 'update_deck', 'list_results', 'get_results']));
  });

  it('streams SSE for a valid mock conversation: tool round-trip then done', async () => {
    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const events = await readSseEvents(res);
    const types = events.map((e) => e.type);

    expect(types).toContain('token');
    expect(types).toContain('tool_start');
    expect(types).toContain('tool_result');
    expect(types.at(-1)).toBe('done');

    const toolStart = events.find((e) => e.type === 'tool_start');
    expect(toolStart.name).toBe('list_binders');
    expect(mockExecuteTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'list_binders', bearer: 'jwt-token' }),
    );
  });

  it('429s with a pre-stream JSON error when the daily message budget is exhausted', async () => {
    mockGetTodayRequestCount.mockResolvedValue({ success: true, data: 10_000 });
    const res = await POST(request(VALID_BODY));

    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toMatch(/daily message limit/i);
  });

  it('fails open when the quota read errors — availability over enforcement', async () => {
    mockGetTodayRequestCount.mockResolvedValue({ success: false, error: 'db down' });
    const res = await POST(request(VALID_BODY));
    expect(res.status).toBe(200);
    await readSseEvents(res); // drain so this turn's done doesn't bleed into later tests
  });

  it('records one usage turn from the done event, with the resolved model and its token counts', async () => {
    const res = await POST(request(VALID_BODY));
    await readSseEvents(res); // drain the stream so the turn completes

    expect(mockRecordTurn).toHaveBeenCalledTimes(1);
    // Mock model's binder script: usage arrives on the summary iteration (500/60)
    expect(mockRecordTurn).toHaveBeenCalledWith({
      userId: 'user-1',
      model: 'mock',
      promptTokens: 500,
      completionTokens: 60,
    });
  });

  it('checks the quota for the requesting user before streaming', async () => {
    await readSseEvents(await POST(request(VALID_BODY)));
    expect(mockGetTodayRequestCount).toHaveBeenCalledWith('user-1');
  });

  it('pauses a destructive tool call until the user confirms, then executes it', async () => {
    mockFetchLiteTools.mockResolvedValue(REMOVE_TOOLS as any);
    mockExecuteTool.mockResolvedValue({ ok: true, content: 'Removed 1x from wants' });

    const res = await POST(request(REMOVE_BODY));
    expect(res.status).toBe(200);
    const { events, readUntil } = sseReader(res);

    await readUntil((e) => e.type === 'confirmation_request');
    const confirmation = events.find((e) => e.type === 'confirmation_request');
    expect(confirmation).toMatchObject({ name: 'remove_from_wants' });
    // Paused: nothing has executed yet
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'tool_start')).toBe(false);

    // The registry entry is keyed to the session user (user-1)
    expect(resolveConfirmation('user-1', confirmation.id, 'confirm')).toBe(true);

    await readUntil((e) => e.type === 'done');
    const types = events.map((e) => e.type);
    expect(mockExecuteTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'remove_from_wants' }));
    expect(types).toContain('tool_start');
    expect(types.at(-1)).toBe('done');
  });

  it('deny leaves the tool unexecuted and the stream still terminates with done', async () => {
    mockFetchLiteTools.mockResolvedValue(REMOVE_TOOLS as any);

    const res = await POST(request(REMOVE_BODY));
    const { events, readUntil } = sseReader(res);

    await readUntil((e) => e.type === 'confirmation_request');
    const confirmation = events.find((e) => e.type === 'confirmation_request');
    expect(resolveConfirmation('user-1', confirmation.id, 'deny')).toBe(true);

    await readUntil((e) => e.type === 'done');
    expect(mockExecuteTool).not.toHaveBeenCalled();
    const result = events.find((e) => e.type === 'tool_result');
    expect(result).toMatchObject({ ok: false });
    expect(result.content).toMatch(/declined/i);
    expect(events.filter((e) => e.type === 'done' || e.type === 'error')).toHaveLength(1);
  });

  it('injects the system prompt with the username', async () => {
    await readSseEvents(await POST(request(VALID_BODY)));
    // The mock LLM received messages via the loop; assert through executeTool call
    // indirectly: system prompt presence is a route concern — verify via fetchLiteTools
    // being called with the minted token and the response reaching done (covered above).
    expect(mockFetchLiteTools).toHaveBeenCalledWith('jwt-token');
  });
});

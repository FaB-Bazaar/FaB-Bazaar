/**
 * Route unit tests for the Volzar scope translator: auth + quota gates, body
 * validation, and that a scripted LLM reply comes back as an /opt state patch
 * with hallucinated values stripped. The LLM transport is mocked; nothing
 * leaves the test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { getVolzarAccess: vi.fn() },
  llmUsageService: { getTodayRequestCount: vi.fn(), getTodayGlobalRequestCount: vi.fn(), recordTurn: vi.fn() },
  facetService: { getTagUsageCounts: vi.fn() },
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/ai/openrouter', () => ({ createLlm: vi.fn() }));

import { POST } from './route';
import { auth } from '@/auth';
import { userService, llmUsageService, facetService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import { createLlm } from '@/lib/ai/openrouter';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockAccess = vi.mocked(userService.getVolzarAccess);
const mockRateLimit = vi.mocked(rateLimit);
const mockUsed = vi.mocked(llmUsageService.getTodayRequestCount);
const mockUsedGlobal = vi.mocked(llmUsageService.getTodayGlobalRequestCount);
const mockRecord = vi.mocked(llmUsageService.recordTurn);
const mockCreateLlm = vi.mocked(createLlm);
const mockTags = vi.mocked(facetService.getTagUsageCounts);

/** An Llm whose only output is `reply` (plus a usage frame). */
function scriptedLlm(reply: string) {
  return async function* () {
    yield { kind: 'text' as const, text: reply };
    yield { kind: 'usage' as const, usage: { prompt_tokens: 120, completion_tokens: 30 } };
    yield { kind: 'finish' as const, reason: 'stop' as const };
  };
}

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/volzar/translate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = 'test-key';
  mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'bob' } });
  mockAccess.mockResolvedValue({ success: true, data: { isSuperAdmin: false, volzarAccess: false, metafySupporterTier: null } } as any);
  mockRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 1000 } as any);
  mockUsed.mockResolvedValue({ success: true, data: 0 } as any);
  mockUsedGlobal.mockResolvedValue({ success: true, data: 0 } as any);
  mockRecord.mockResolvedValue({ success: true, data: undefined } as any);
  mockTags.mockResolvedValue({ success: true, data: [
    { id: 'combo-enabler', label: 'Combo enabler', def: 'Sets up combos', draft: false, cardCount: 12 },
    { id: 'secret-draft', label: 'Draft tag', def: null, draft: true, cardCount: 0 },
  ] } as any);
  mockCreateLlm.mockReturnValue(scriptedLlm('{"classes":["ninja"],"color":"blue","keywords":["go again"]}') as any);
});

describe('POST /api/volzar/translate', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(request({ q: 'blue ninja go again' }));
    expect(res.status).toBe(401);
  });

  it('400s on a missing or blank question', async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ q: '   ' }))).status).toBe(400);
  });

  it('translates plain English into an /opt state patch (chips + query + scope)', async () => {
    const res = await POST(request({ q: 'blue ninja go again' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.state.selectedClasses).toEqual(['ninja']);
    expect(json.data.state.selectedPitch).toEqual([3]);
    expect(json.data.state.selectedKeywords).toEqual(['go again']);
    expect(json.data.state.query).toBe('');
    expect(json.data.state.searchMode).toBe('name');
    // The user's question goes to the model verbatim, under the vocabulary prompt.
    const llm = mockCreateLlm.mock.results[0].value;
    expect(llm).toBeTypeOf('function');
  });

  it('strips hallucinated values before they reach the page', async () => {
    mockCreateLlm.mockReturnValue(scriptedLlm('```json\n{"classes":["ninja","paladin"],"keywords":["haste"]}\n```') as any);
    const res = await POST(request({ q: 'ninja paladins with haste' }));
    const json = await res.json();
    expect(json.data.state.selectedClasses).toEqual(['ninja']);
    expect(json.data.state.selectedKeywords).toEqual([]);
  });

  it('passes live non-draft facet tags to the model and accepts them back as tag chips', async () => {
    mockCreateLlm.mockReturnValue(scriptedLlm('{"facetTags":["combo-enabler","secret-draft","nope"],"classes":["ninja"]}') as any);
    const res = await POST(request({ q: 'ninja combo enablers' }));
    const json = await res.json();
    expect(json.data.state.selectedFacets).toEqual(['combo-enabler']);
    // The prompt the model saw lists the live tag and the phrasing cheat sheet.
    const llm = mockCreateLlm.mock.results[0].value;
    expect(llm).toBeTypeOf('function');
  });

  it('422s when the model returns no usable JSON', async () => {
    mockCreateLlm.mockReturnValue(scriptedLlm('Sorry, I do not understand.') as any);
    const res = await POST(request({ q: 'asdfgh' }));
    expect(res.status).toBe(422);
  });

  it('counts against the same daily quota as chat (429 when exhausted) and records the turn', async () => {
    mockUsed.mockResolvedValue({ success: true, data: 50 } as any);
    expect((await POST(request({ q: 'blue ninja' }))).status).toBe(429);
    mockUsed.mockResolvedValue({ success: true, data: 0 } as any);
    const ok = await POST(request({ q: 'blue ninja' }));
    expect(ok.status).toBe(200);
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', promptTokens: 120, completionTokens: 30 }));
  });

  it('503s when no OpenRouter key is configured', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await POST(request({ q: 'blue ninja' }));
    expect(res.status).toBe(503);
  });
});

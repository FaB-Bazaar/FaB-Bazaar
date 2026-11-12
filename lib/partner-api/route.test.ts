import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('./auth', () => ({ authenticatePartner: vi.fn() }));

import { partnerRoute, partnerOk, partnerError } from './route';
import { authenticatePartner } from './auth';

const mockAuth = vi.mocked(authenticatePartner);
const request = () => new NextRequest('http://localhost/api/partner/v1/binders');
const context = <P>(params: P) => ({ params: Promise.resolve(params) });

describe('partnerRoute', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('runs the handler with the caller and route params once the scope check passes', async () => {
    mockAuth.mockResolvedValue({ ok: true, userId: 'u-1', clientId: 'c-1', scopes: new Set(['decks:read']) });
    const handler = vi.fn(async ({ auth, params }) => partnerOk({ user: auth.userId, deck: params.deckId }));

    const response = await partnerRoute<{ deckId: string }>('decks:read', handler)(request(), context({ deckId: 'd-1' }));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { user: 'u-1', deck: 'd-1' } });
  });

  it('answers 401 with a bearer challenge and never runs the handler', async () => {
    mockAuth.mockResolvedValue({ ok: false, status: 401, code: 'unauthorized', message: 'no token' });
    const handler = vi.fn();

    const response = await partnerRoute('decks:read', handler)(request(), context({}));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Bearer');
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'unauthorized', message: 'no token' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers 403 when the scope is missing', async () => {
    mockAuth.mockResolvedValue({ ok: false, status: 403, code: 'insufficient_scope', message: 'missing' });

    const response = await partnerRoute('decks:write', vi.fn())(request(), context({}));

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('insufficient_scope');
  });

  it('turns a thrown error into a 500 that does not leak the message', async () => {
    mockAuth.mockResolvedValue({ ok: true, userId: 'u-1', clientId: null, scopes: new Set() });

    const response = await partnerRoute('decks:read', async () => {
      throw new Error('column "secret" does not exist');
    })(request(), context({}));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('builds error responses with optional details', async () => {
    const response = partnerError(422, 'nothing_resolved', 'No cards matched.', { unresolved: [1] });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'nothing_resolved', message: 'No cards matched.', details: { unresolved: [1] } },
    });
  });
});

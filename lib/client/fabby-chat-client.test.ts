/**
 * Unit tests for the fabby-chat client's pure SSE frame parser — the piece
 * that must survive frames split across arbitrary network chunk boundaries —
 * and the confirm/deny resolver for destructive tool calls.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSseFrames, resolveConfirmation } from './fabby-chat-client';

describe('parseSseFrames', () => {
  it('parses complete frames and returns leftover buffer', () => {
    const { events, rest } = parseSseFrames(
      'data: {"type":"token","text":"Hi"}\n\ndata: {"type":"done","iterations":1}\n\ndata: {"type":"tok',
    );
    expect(events).toEqual([
      { type: 'token', text: 'Hi' },
      { type: 'done', iterations: 1 },
    ]);
    expect(rest).toBe('data: {"type":"tok');
  });

  it('handles a buffer with no complete frame', () => {
    const { events, rest } = parseSseFrames('data: {"type":"to');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"type":"to');
  });

  it('skips malformed frames without dying', () => {
    const { events } = parseSseFrames('data: {not json}\n\ndata: {"type":"token","text":"ok"}\n\n');
    expect(events).toEqual([{ type: 'token', text: 'ok' }]);
  });

  it('reassembles a frame split mid-JSON across two parses', () => {
    const first = parseSseFrames('data: {"type":"token","te');
    const second = parseSseFrames(first.rest + 'xt":"joined"}\n\n');
    expect(second.events).toEqual([{ type: 'token', text: 'joined' }]);
  });
});

describe('resolveConfirmation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the decision to the confirm endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { resolved: true } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveConfirmation({ id: 'c1', decision: 'confirm' });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/fabby-chat/confirm', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: 'c1', decision: 'confirm' });
  });

  it('surfaces the server error message on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'No pending confirmation for that id — it may have expired' }), { status: 404 }),
    ));

    const result = await resolveConfirmation({ id: 'ghost', decision: 'deny' });
    expect(result).toEqual({ success: false, error: 'No pending confirmation for that id — it may have expired' });
  });

  it('turns a network failure into an ApiResponse error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await resolveConfirmation({ id: 'c1', decision: 'confirm' });
    expect(result).toEqual({ success: false, error: 'offline' });
  });
});

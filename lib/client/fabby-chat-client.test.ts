/**
 * Unit tests for the fabby-chat client's pure SSE frame parser — the piece
 * that must survive frames split across arbitrary network chunk boundaries.
 */

import { describe, it, expect } from 'vitest';
import { parseSseFrames } from './fabby-chat-client';

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

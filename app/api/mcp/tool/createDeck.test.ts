/**
 * Unit tests for the create_deck MCP handler — specifically the upfront
 * hero/format mismatch guardrail. Mirrors the search-time guardrail so a
 * malformed combination (e.g. adult hero + Silver Age, young hero + Classic
 * Constructed) is rejected before any printingsService or HTTP call.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  bannedCardsService: {
    listBannedHeroIds: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

vi.mock('./helpers', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { createDeckTool } from './createDeck';

describe('createDeckTool.handler — hero/format guardrail', () => {
  it('rejects an adult hero name with format Silver Age and points to the young name', async () => {
    const result = await createDeckTool.handler(
      { name: 'Test', format: 'Silver Age', heroName: 'kano, dracai of aether' },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(false);
    const err = (result as any).error ?? '';
    expect(err).toMatch(/silver age|silver_age/i);
    expect(err).toMatch(/young/i);
    expect(err).toMatch(/kano/);
  });

  it('rejects a young hero name with format Classic Constructed and points to the adult name', async () => {
    const result = await createDeckTool.handler(
      { name: 'Test', format: 'Classic Constructed', heroName: 'kano' },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(false);
    const err = (result as any).error ?? '';
    expect(err).toMatch(/classic constructed|cc/i);
    expect(err).toMatch(/adult/i);
    expect(err).toMatch(/kano, dracai of aether/i);
  });

  it('rejects a young hero in Living Legend (LL requires adult)', async () => {
    const result = await createDeckTool.handler(
      { name: 'Test', format: 'Living Legend', heroName: 'kano' },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(false);
    const err = (result as any).error ?? '';
    expect(err).toMatch(/living legend|ll/i);
    expect(err).toMatch(/adult/i);
  });

  it('rejects an adult hero in Blitz (Blitz requires young)', async () => {
    const result = await createDeckTool.handler(
      { name: 'Test', format: 'Blitz', heroName: 'kano, dracai of aether' },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(false);
    const err = (result as any).error ?? '';
    expect(err).toMatch(/blitz/i);
    expect(err).toMatch(/young/i);
  });

  it('does not call printingsService when the guardrail rejects (early return)', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await createDeckTool.handler(
      { name: 'Test', format: 'Silver Age', heroName: 'kano, dracai of aether' },
      undefined,
      'fake-token',
    );

    expect(printingsService.searchPrintings).not.toHaveBeenCalled();
  });

  it('skips the guardrail for free-form formats (Casual / Limited / UPF)', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    // Casual has no hero/format constraint — should fall through past the
    // guardrail and proceed to hero resolution. Since the mock returns an
    // empty fake DB, the handler will fail later on a different code path,
    // but it should NOT fail with the guardrail's "did you mean" message.
    const result = await createDeckTool.handler(
      { name: 'Test', format: 'Casual', heroName: 'kano' },
      undefined,
      'fake-token',
    );
    if (!result.success) {
      const err = (result as any).error ?? '';
      expect(err).not.toMatch(/did you mean/i);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { getDeckTool } from './getDeck';

describe('getDeckTool MCP Apps metadata', () => {
  it('declares the deck viewer ui resource via _meta.ui.resourceUri', () => {
    expect((getDeckTool as any)._meta?.ui?.resourceUri).toBe(
      'ui://deck/viewer.html'
    );
  });
});

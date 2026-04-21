import { describe, it, expect } from 'vitest';
import { getBinderTool } from './getBinder';

describe('getBinderTool MCP Apps metadata', () => {
  it('declares the shared card-grid ui resource via _meta.ui.resourceUri', () => {
    expect((getBinderTool as any)._meta?.ui?.resourceUri).toBe(
      'ui://card-grid/viewer.html'
    );
  });
});

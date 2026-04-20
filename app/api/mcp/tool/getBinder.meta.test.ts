import { describe, it, expect } from 'vitest';
import { getBinderTool } from './getBinder';

describe('getBinderTool MCP Apps metadata', () => {
  it('declares a ui resource via _meta.ui.resourceUri', () => {
    expect((getBinderTool as any)._meta?.ui?.resourceUri).toBe(
      'ui://binder/viewer.html'
    );
  });
});

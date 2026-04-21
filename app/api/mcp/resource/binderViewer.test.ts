import { describe, it, expect } from 'vitest';
import { binderViewerResource } from './binderViewer';

describe('binderViewerResource', () => {
  it('declares the ui:// URI expected by the get_binder tool meta', () => {
    expect(binderViewerResource.uri).toBe('ui://binder/viewer.html');
  });

  it('uses the MCP Apps HTML profile mime type', () => {
    expect(binderViewerResource.mimeType).toBe('text/html;profile=mcp-app');
  });

  it('serves a non-empty HTML document that mounts the app', async () => {
    const html = await binderViewerResource.handler();

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('id="binder-app"');
    expect(html).toContain('connect();');
    expect(html).toContain('ui/initialize');
  });

  it('declares imagedelivery.net in _meta.ui.csp.resourceDomains', () => {
    expect(binderViewerResource._meta?.ui?.csp?.resourceDomains).toContain(
      'https://imagedelivery.net'
    );
  });
});

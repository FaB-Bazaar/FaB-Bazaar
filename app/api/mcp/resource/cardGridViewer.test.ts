import { describe, it, expect } from 'vitest';
import { cardGridViewerResource } from './cardGridViewer';

describe('cardGridViewerResource', () => {
  it('declares the shared ui://card-grid/viewer.html URI', () => {
    expect(cardGridViewerResource.uri).toBe('ui://card-grid/viewer.html');
  });

  it('uses the MCP Apps HTML profile mime type', () => {
    expect(cardGridViewerResource.mimeType).toBe('text/html;profile=mcp-app');
  });

  it('serves a non-empty HTML document that mounts the app', async () => {
    const html = await cardGridViewerResource.handler();

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('id="binder-app"');
    expect(html).toContain('connect();');
    expect(html).toContain('ui/initialize');
  });

  it('declares imagedelivery.net in _meta.ui.csp.resourceDomains', () => {
    expect(cardGridViewerResource._meta?.ui?.csp?.resourceDomains).toContain(
      'https://imagedelivery.net'
    );
  });
});

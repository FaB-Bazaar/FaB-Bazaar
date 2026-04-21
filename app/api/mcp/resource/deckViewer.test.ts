import { describe, it, expect } from 'vitest';
import { deckViewerResource } from './deckViewer';

describe('deckViewerResource', () => {
  it('declares the ui://deck/viewer.html URI', () => {
    expect(deckViewerResource.uri).toBe('ui://deck/viewer.html');
  });

  it('uses the MCP Apps HTML profile mime type', () => {
    expect(deckViewerResource.mimeType).toBe('text/html;profile=mcp-app');
  });

  it('serves a non-empty HTML document that mounts the app', async () => {
    const html = await deckViewerResource.handler();

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('id="hud"');
    expect(html).toContain('id="panel-decklist"');
    expect(html).toContain('id="panel-pitch"');
    expect(html).toContain('id="panel-stats"');
    expect(html).toContain('id="panel-matchups"');
    expect(html).toContain('connect();');
    expect(html).toContain('ui/initialize');
  });

  it('declares imagedelivery.net in _meta.ui.csp.resourceDomains', () => {
    expect(deckViewerResource._meta?.ui?.csp?.resourceDomains).toContain(
      'https://imagedelivery.net'
    );
  });
});

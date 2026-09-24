import { describe, it, expect } from 'vitest';
import { summarizeClientHello } from './client-hello';

describe('summarizeClientHello', () => {
  it('reports the client, protocol, capability keys and whether it declares MCP Apps UI', () => {
    const summary = summarizeClientHello({
      protocolVersion: '2025-06-18',
      clientInfo: { name: 'claude-ai', version: '0.1.0' },
      capabilities: {
        roots: {},
        extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } },
      },
    });
    expect(summary).toEqual({
      client: 'claude-ai',
      version: '0.1.0',
      protocol: '2025-06-18',
      capabilities: ['extensions', 'roots'],
      mcpAppsUi: true,
      extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } },
      experimental: null,
    });
  });

  it('keeps experimental capabilities (hosts put their own display extensions there)', () => {
    const summary = summarizeClientHello({
      clientInfo: { name: 'muse' },
      capabilities: { experimental: { 'meta/cards': { images: true } } },
    });
    expect(summary.mcpAppsUi).toBe(false);
    expect(summary.experimental).toEqual({ 'meta/cards': { images: true } });
  });

  it('tolerates a missing or malformed hello', () => {
    expect(summarizeClientHello(undefined)).toMatchObject({ client: null, capabilities: [], mcpAppsUi: false });
    expect(summarizeClientHello({ clientInfo: 'x', capabilities: 5 })).toMatchObject({ client: null, capabilities: [] });
  });

  it('caps oversized capability blobs so a client cannot flood the logs', () => {
    const huge = { blob: 'x'.repeat(10_000) };
    const summary = summarizeClientHello({ capabilities: { experimental: huge } });
    expect(JSON.stringify(summary).length).toBeLessThan(3_000);
  });
});

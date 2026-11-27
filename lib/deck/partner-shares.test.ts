import { describe, it, expect } from 'vitest';
import { appsThatCanPlay } from './partner-shares';

const app = (client_id: string, scopes: string[], client_uri?: string) => ({
  client_id, client_name: `${client_id} name`, client_uri, scopes, authorized_at: new Date('2026-11-01'),
});

describe('appsThatCanPlay', () => {
  it('keeps apps the user gave deck access through the partner API', () => {
    expect(appsThatCanPlay([
      app('cintari', ['decks:read'], 'https://cintari.example/app'),
      app('writer', ['cards:read decks:write']), // write includes read
    ])).toEqual([
      { client_id: 'cintari', name: 'cintari name', site: 'cintari.example' },
      { client_id: 'writer', name: 'writer name', site: null },
    ]);
  });

  it('leaves out apps without deck access, and full-account apps the play API refuses', () => {
    expect(appsThatCanPlay([
      app('binder-only', ['collection:read']),
      app('claude', ['read write']),
      app('mcp', ['claudeai']),
    ])).toEqual([]);
  });

  it('counts deck access from any one of several grants', () => {
    expect(appsThatCanPlay([app('two-grants', ['cards:read', 'decks:read'])]).map(a => a.client_id)).toEqual(['two-grants']);
  });
});
